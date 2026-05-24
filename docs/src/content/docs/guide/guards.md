---
title: Guards
description: Authorization helpers called early in `run`. Same code path on every surface, narrows types for free, composes by writing TypeScript.
sidebar:
    order: 6
---

A **guard** is a small function you call near the top of an action's `run` to refuse the call early. Vyn does not ship a declarative
"requires" field. The reason is straightforward: real-world auth gets complex fast (multi-tenant scoping, resource ownership, mixed token
types, conditional gating), and any declarative list runs out of road. Plain TypeScript functions don't.

Because guards live inside `run`, they fire identically on every surface — typed RPC, agent tool calls, MCP, CLI, queue workers, and direct
`.run()` from tests. There is no separate "middleware tier" that one surface could bypass. The action is the single place authorization is
enforced.

## The pattern

Guards are functions that either return (success) or throw an `RpcError` (failure). Use TypeScript's `asserts` clause to narrow types for
everything that follows the call:

```ts
// features/auth/guards.ts
import { RpcError } from "@vynjs/core";
import type { Ctx } from "../../ctx.ts";
import type { Session } from "./session.ts";

export function requireSession<C extends Ctx>(
	opts: { ctx: C },
): asserts opts is { ctx: C & { session: Session } } {
	if (!opts.ctx.session) {
		throw new RpcError("unauthorized", "not signed in");
	}
}
```

The `asserts opts is ...` return type is the load-bearing trick. After calling `requireSession(opts)`, TypeScript knows `opts.ctx.session`
is non-null for the rest of the function body. No `?.`, no manual casts.

Use it like this:

```ts
// features/notes/notes.actions.ts
import { createQuery, v } from "@vynjs/core";
import { requireSession } from "../auth/guards.ts";
import { NoteSchema } from "./note.ts";

export const list = createQuery({
	description: "List the current user's notes.",
	input: v.object({}),
	output: v.array(NoteSchema),
	run: async (opts) => {
		requireSession(opts);
		// opts.ctx.session is now Session, not Session | null.
		return opts.ctx.db
			.prepare("SELECT * FROM notes WHERE userId = ?")
			.all(opts.ctx.session.userId);
	},
});
```

One line of guard, full type narrowing, identical behavior on every surface that calls the action.

## Why inline beats declarative

A declarative `requires: [session, admin]` field reads cleanly until the requirements stop being a flat list. Real apps hit cases like:

- **Tenant-scoped checks** — "user must be a member of the tenant named in `input.tenantId`."
- **Resource ownership** — "user must own the note with id `input._id`," requiring a DB query against the input.
- **Conditional gating** — "this mutation requires admin only if `input.deleteUser` is true."
- **Mixed auth shapes** — "session cookie OR API bearer OR signed webhook token, any of the three."

A declarative list either grows into a DSL (with combinators, factories, and ordering rules) or papers over the complexity by hiding it
inside guard implementations. Both make the action harder to read.

Plain function calls in `run` make the check obvious at the call site. If two guards need to coordinate, you write two function calls. If a
guard needs `input` to do its query, you pass `opts.input` to it. The control flow is the code.

## Composing guards

Guards compose by being TypeScript functions. There is no special combinator API — `if/else`, `||`, and `await` are the combinators.

### Multiple checks

Just list the calls:

```ts
run: async opts => {
	requireSession(opts);
	requireAdmin(opts);
	return /* ... */;
},
```

### Alternatives ("session OR API key")

Try one, fall back to the other:

```ts
function requireAuth(
	opts: { ctx: Ctx },
): asserts opts is { ctx: Ctx & { session: Session } } {
	if (opts.ctx.session) return;
	const key = opts.ctx.req.headers.get("authorization");
	if (key && verifyApiKey(key, opts.ctx.db)) return;
	throw new RpcError("unauthorized", "session or API key required");
}
```

### Resource ownership

Take whatever input fields you need and do the query yourself:

```ts
async function requireOwner(opts: { input: { _id: string }; ctx: Ctx & { session: Session } }) {
	const row = opts.ctx.db
		.prepare("SELECT userId FROM notes WHERE _id = ?")
		.get(opts.input._id) as { userId: string } | undefined;
	if (!row) throw new RpcError("not_found", "no such note");
	if (row.userId !== opts.ctx.session.userId) {
		throw new RpcError("forbidden", "not your note");
	}
}

// usage
run: async opts => {
	requireSession(opts);
	await requireOwner(opts);
	// ...
},
```

### Conditional gating

Branch on input. There's nothing to invent:

```ts
run: async opts => {
	requireSession(opts);
	if (opts.input.deleteUser) requireAdmin(opts);
	// ...
},
```

### Multi-tenant scoping

Add the tenant assertion to the guard, narrow the type:

```ts
function requireTenantMember<C extends Ctx>(
	opts: { input: { tenantId: string }; ctx: C & { session: Session } },
): asserts opts is { input: { tenantId: string }; ctx: C & { session: Session; tenant: Tenant } } {
	const tenant = opts.ctx.db
		.prepare("SELECT * FROM tenants t INNER JOIN tenant_members m ON t._id = m.tenantId WHERE t._id = ? AND m.userId = ?")
		.get(opts.input.tenantId, opts.ctx.session.userId) as Tenant | undefined;
	if (!tenant) throw new RpcError("forbidden", "not a member of this tenant");
	(opts.ctx as { tenant: Tenant }).tenant = tenant;
}

// usage — `opts.ctx.tenant` typed downstream
run: async opts => {
	requireSession(opts);
	requireTenantMember(opts);
	return opts.ctx.db.notes.where({ tenantId: opts.ctx.tenant._id }).all();
},
```

For the last pattern, the guard both checks access and attaches the loaded tenant to `ctx` so subsequent code doesn't re-query. This is
where inline guards earn their keep — declarative would require a factory + a result-passing protocol; the function call just does it.

## Errors that surfaces can map

Throw `RpcError(category, message)` to signal the failure with a category the surface can translate:

| Category       | RPC HTTP | What it means                                               |
| -------------- | -------- | ----------------------------------------------------------- |
| `unauthorized` | 401      | not signed in                                               |
| `forbidden`    | 403      | signed in, but not allowed                                  |
| `not_found`    | 404      | resource missing (or hidden from this caller)               |
| `conflict`     | 409      | precondition failed (duplicate email, optimistic-lock loss) |
| `bad_request`  | 400      | invalid input the schema didn't catch                       |
| `internal`     | 500      | bug                                                         |

The agent layer surfaces these as tool errors with the category attached, so the model can react sensibly to "you're forbidden" vs "the
resource doesn't exist." MCP and CLI map them to their protocol shapes the same way.

See [Errors](/vyn/guide/errors/) (coming) for the full list and how each surface translates them.

## When to extract a guard

Inline a check the first time you write it. Extract to a named function when:

- The same check appears in three or more actions.
- The check has a name worth attaching to errors and telemetry (`requireSession`, `requireOwner`, `requireTenantMember`).
- The check narrows a type the rest of `run` will read.

Until then, an inline `if (!opts.ctx.session) throw new RpcError(...)` in one action is honest. Don't extract until duplication forces it.

## Testing guards

Because guards are plain functions, test them directly:

```ts
import { requireSession } from "./guards.ts";
import { RpcError } from "@vynjs/core";

test("requireSession throws when session is null", () => {
	expect(() => requireSession({ ctx: { session: null } })).toThrow(RpcError);
});
```

For end-to-end action tests, build a ctx that either satisfies the guard or doesn't and call `action.run(opts)`. Same code path production
runs.

## See also

- [Actions](/vyn/guide/actions/) — guards live inside `run`, not as an action field
- [Configuration](/vyn/guide/configuration/) — what's on `ctx` for guards to read
- [Errors](/vyn/guide/errors/) — `RpcError` categories and surface mapping (coming)

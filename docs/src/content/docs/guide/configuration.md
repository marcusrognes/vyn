---
title: Configuration
description: How to declare environment variables and per-request context with strict types and clear precedence.
sidebar:
  order: 3
---

Actions need two kinds of runtime values: **environment variables**
(boot-time constants — database URL, API keys, mode flags) and **per-request
context** (the database handle bound to this request, the authenticated
session, the request itself). Vyn handles both with the same primitive
you already know: `v.*` schemas. Validate at the boundary, then use
typed values inside.

## Environment variables

Declare every environment variable you need as a schema. Parse
`process.env` (or `Deno.env.toObject()`) once at boot. The parsed
result is your typed `env` object — import it anywhere.

```ts
// env.ts
import { v } from "@vyn/core";

export const env = v.object({
	DATABASE_URL: v.string().url(),
	SESSION_SECRET: v.string().min(32),
	PORT: v.string().regex(/^\d+$/).default("8000"),
	NODE_ENV: v.string().regex(/^(development|production|test)$/).default("development"),
	OPENAI_KEY: v.string().optional(),
}).parse(
	typeof Deno !== "undefined" ? Deno.env.toObject() : process.env,
);
```

That's the whole pattern. Some things to notice:

- **Boot fails fast.** If a required variable is missing, `.parse()`
  throws at module load. No "undefined is not a function" three hours
  later — the failure has the variable name in it and points at the
  schema.
- **Defaults are real defaults.** `PORT` is `"8000"` if unset.
  `NODE_ENV` is `"development"`. The defaults are in code where you can
  see them, not in shell scripts or `.env.example` files that drift.
- **Constraints are constraints.** `.url()`, `.min(32)`, regex
  patterns — same modifiers you use for action input. An accidentally
  short session secret is a boot-time error, not a security incident
  later.
- **Optional is optional.** `OPENAI_KEY` is `undefined` if missing. The
  type reflects it (`string | undefined`); using it without a guard is
  a type error.

The `env` binding is a plain object, fully typed by inference:

```ts
import { env } from "../env.ts";

env.DATABASE_URL;   // string (URL)
env.PORT;           // string (regex-validated digit run)
env.OPENAI_KEY;     // string | undefined
```

Use `env` from anywhere — actions, route modules, the server boot
file. The validation has already happened.

### Where the file lives

Put `env.ts` at the project root, next to `server.ts`. It is
import-side-effect: the first import causes the parse. Vyn does not
ship a special "load envs" step.

### Runtime-specific reads

`process.env` (Node) and `Deno.env.toObject()` (Deno) return slightly
different shapes — Node returns `{ [k: string]: string | undefined }`,
Deno returns `{ [k: string]: string }`. The schema accepts either
because every field declares its own validator; missing keys parse as
`undefined` and either default (if present) or fail (if required).

### Local development

For local development, both runtimes pick up a `.env` file
automatically — `node --env-file=.env` on Node, `deno --env-file=.env`
on Deno. Vyn does not parse `.env` files itself; that's the runtime's
job. Keep `.env` out of version control; commit a `.env.example` so
contributors know what to set.

## Context

Context is the object every action receives as `opts.ctx`. Vyn splits
it into three layers, each with a clear role and strict precedence.

### Three layers

| Layer | Built when | Lives for | Use for |
|---|---|---|---|
| **BaseCtx**     | every request | one request | `req`, `signal`, `setCookie`, `setHeader`, `setStatus`, `bus` — framework-provided, you cannot shadow |
| **Static ctx**  | once at boot  | the process | database pool, logger, feature-flag client, S3 client — shared resources |
| **Dynamic ctx** | every request | one request | session, current user, request-scoped transaction — request-derived |

The merge rule:

```
opts.ctx = { ...staticCtx, ...dynamicCtx, ...baseCtx }
//          foundation    overrides       framework wins
```

- **BaseCtx always wins.** You cannot accidentally break framework
  helpers by shadowing.
- **Dynamic wins over static.** If a per-request transaction wants to
  replace the shared `db` handle with a transaction-bound one, it
  does so by returning `{ db: tx }` from `createContext`.
- **Static is the foundation.** Everything that doesn't change per
  request lives here.

### BaseCtx (framework-provided)

Vyn always populates these. They're available in every action, every
guard, every loader.

| Field | Type | What it is |
|---|---|---|
| `req`        | `Request`     | The raw incoming Request. Read headers, cookies, URL. |
| `signal`     | `AbortSignal` | Fires when the client disconnects or the request is cancelled. |
| `setCookie`  | function      | Set a cookie on the outgoing response. |
| `setHeader`  | function      | Set an arbitrary response header. |
| `setStatus`  | function      | Override the HTTP status code on the outgoing response. |
| `bus`        | `Bus`         | Subscribe/publish for the in-process or pluggable event bus. |

If your `createContext` returns `{ setCookie: myCookieFn }`, Vyn's
`setCookie` still wins — the merge applies BaseCtx last. Use a
different name for app-specific cookie helpers
(`opts.ctx.setAuthCookie`, `opts.ctx.setMyThing`).

### Static ctx

The static ctx is built once at boot, before the server starts
accepting connections. Put long-lived shared resources here:

```ts
// server.ts
import { serve } from "@vyn/server";
import { env } from "./env.ts";
import { openDb } from "./db.ts";
import { createLogger } from "./log.ts";
import "./_vyn.gen.ts";

serve({
	port: Number(env.PORT),

	staticContext: async () => {
		const db     = await openDb(env.DATABASE_URL);
		const logger = createLogger({ level: env.LOG_LEVEL });
		return { db, logger };
	},

	createContext: /* ... see below ... */,
});
```

The factory may be `async`. The server waits for it to resolve before
binding the port — a failed static setup fails boot, not a request.

Static ctx is **not rebuilt** per request. It's captured once and
flowed into every dynamic ctx call. If the database connection drops,
that's a long-lived-resource problem to solve in `openDb`, not by
rebuilding the static ctx.

### Dynamic ctx (`createContext`)

The dynamic ctx is the per-request layer. The factory receives the
already-built static ctx, the request, and the response-shaping
helpers — so it can refresh sessions, set cookies, or open
transactions before any handler runs.

```ts
serve({
	// ...
	createContext: async ({ req, setCookie, staticCtx }) => {
		const session = await readSession(req, staticCtx.db);
		if (session && session.expiresAt - Date.now() < 60_000) {
			await refreshSession(session, staticCtx.db, setCookie);
		}
		return { session };
	},
});
```

Things to notice:

- `staticCtx` is a typed parameter — you don't reach for module-scope
  bindings.
- The dynamic ctx returns just the per-request additions
  (`session`). It does not re-return `db` or `logger`; those are
  already in the static layer.
- For transaction-scoped overrides, return the override:
  `{ db: tx, session }` — it wins over `staticCtx.db` for this request
  only.

### What lands on `opts.ctx`

```ts
opts.ctx.db         // staticCtx (or dynamicCtx if you returned an override)
opts.ctx.logger     // staticCtx
opts.ctx.session    // dynamicCtx
opts.ctx.req        // baseCtx
opts.ctx.signal     // baseCtx
opts.ctx.setCookie  // baseCtx
opts.ctx.setHeader  // baseCtx
opts.ctx.setStatus  // baseCtx
opts.ctx.bus        // baseCtx
```

### Typing your ctx

Declare a `Ctx` type once and use it from each action that needs the
extras. The full ctx is the intersection of all three layers.

```ts
// ctx.ts
import type { BaseCtx } from "@vyn/server";
import type { Database } from "./db.ts";
import type { Logger } from "./log.ts";
import type { Session } from "./features/auth/session.ts";

export type StaticCtx  = { db: Database; logger: Logger };
export type DynamicCtx = { session: Session | null };
export type Ctx        = BaseCtx & StaticCtx & DynamicCtx;
```

Then in an action that needs the database or session, annotate `opts`:

```ts
import type { Ctx } from "../../ctx.ts";

export const create = createMutation({
	description: "Create a note.",
	input:  NoteSchema,
	output: NoteSchema,
	run: async (opts: { input: Note; ctx: Ctx }) => {
		const note = await opts.ctx.db.notes.insert(NoteSchema.create(opts.input)).get();
		onCreated.emit(note);
		return note;
	},
});
```

Or the generic-parameter form:

```ts
export const create = createMutation<Note, Note, Ctx>({ ... });
```

Pick the form that reads best for your codebase.

### When the split earns its keep

For a tiny app — like the [todo tutorial](/vyn/tutorials/build-a-todo/),
where state is an in-memory `Map` — you don't need static ctx at all.
A single `createContext: () => ({ todos })` works fine. The split
becomes load-bearing once you have:

- a real database whose connection pool should be built once,
- a logger that should not be reconstructed per request,
- an auth layer that needs static resources (the DB) to derive
  per-request state (the session),
- multiple actions that want to swap the `db` for a transaction-scoped
  variant per request.

Reach for `staticContext` when those start to apply. Until then, a
single `createContext` is fine — the framework treats a missing
`staticContext` as `() => ({})`.

## Transformer (wire serialization)

`JSON.stringify` loses information. Dates become ISO strings, `Map`s
and `Set`s become empty objects, `BigInt` throws, `Date` round-trips
through `new Date(string)` but only for some shapes, and `undefined`
silently disappears from arrays. For apps that only move `string` /
`number` / `boolean` over the wire, this is fine. For everything else,
configure a **transformer** — a serializer/deserializer pair applied
to every action's input, output, and emitted subscription value.

```ts
// server.ts
import { serve } from "@vyn/server";
import superjson from "superjson";

serve({
	port: Number(env.PORT),
	transformer: superjson,
});
```

```ts
// public/routes/index.ts
import { createApp } from "@vyn/client";
import superjson from "superjson";
import type { AppRouter } from "../../_vyn.gen.ts";

const { rpc } = createApp<AppRouter>({ transformer: superjson });
```

That's the whole setup. From here:

- `Date`, `Map`, `Set`, `BigInt`, `RegExp`, `URL`, `undefined` in
  arrays — all preserved end-to-end.
- A validator like `v.date()` sees a real `Date` on the server and
  yields a real `Date` to the client. No manual `new Date(...)` calls
  in route modules.
- Subscription `opts.events` and `yield`ed values are transformed the
  same way as queries and mutations.

### The contract

A transformer is any object with these two methods:

```ts
type Transformer = {
	serialize(value: unknown):   { json: unknown; meta?: unknown };
	deserialize(serialized: { json: unknown; meta?: unknown }): unknown;
};
```

SuperJSON, devalue, and several others implement this shape directly.
For something custom, write your own:

```ts
const dateOnly: Transformer = {
	serialize: value => ({ json: JSON.parse(JSON.stringify(value, (_, v) => v instanceof Date ? `@date:${v.toISOString()}` : v)) }),
	deserialize: ({ json }) => JSON.parse(JSON.stringify(json), (_, v) => typeof v === "string" && v.startsWith("@date:") ? new Date(v.slice(6)) : v),
};
```

That example is intentionally crude; reach for a real library unless
you have a specific reason.

### What does and doesn't go through

| Carries the transformer | Skips it |
|---|---|
| Action `input` from client to server | Validation errors (raw JSON) |
| Action `output` from server to client | HTTP headers / cookies (text) |
| Subscription `yield`ed values         | The schema definitions themselves (JSON Schema for OpenAPI / MCP) |
| `RpcError.details` payload            | Static assets and SPA shell |
| MCP tool inputs and outputs           | The transformer config itself (chicken-and-egg) |

The MCP surface honors the configured transformer for tool inputs
and outputs so an LLM client that supports transforms can preserve
types end-to-end. For MCP clients that don't, the surface falls back
to JSON-safe shapes — the server still runs the actions correctly.

### Configuration symmetry

The client transformer **must match** the server transformer. They
serialize each other's bytes. If they disagree, you get either runtime
errors (deserialization fails) or silent data loss (object shapes
mangled). The recommended way to enforce this is a small shared
module:

```ts
// transform.ts
import superjson from "superjson";
export const transformer = superjson;
```

Both `server.ts` and the client entry import from `transform.ts`.
One source of truth, one upgrade path when you change libraries.

### Performance

Transformers are not free. Every payload pays a parse + walk cost.
For most apps this is invisible. For high-throughput WS subscriptions,
benchmark before assuming. If a particular subscription emits
JSON-safe shapes only, you can skip its transformer by emitting
already-serialized payloads — but the easier win is to just emit less
data per event.

## Why this split

Boot-time vs request-time is the central distinction:

- **Env** is the same for every request. Validate once, store as a
  module-scope constant. Don't pass through ctx — that would imply
  per-request variability that doesn't exist.
- **Ctx** changes per request. The database connection might be the
  same instance, but the session, the request itself, and the response
  helpers are different each time. They belong in ctx, not in module
  scope.

If you find yourself reading `env.SOMETHING` inside an action, that's
fine — module-scope reads are fast and correct. If you find yourself
mutating something at module scope per-request, move it to ctx.

## See also

- [Actions](/vyn/guide/actions/) — `opts.ctx` is what `run` receives
- [Models](/vyn/guide/models/) — same `v.*` validators, same defaults rules
- [Auth](/vyn/guide/auth/) — uses ctx to read and refresh the session
  (coming)

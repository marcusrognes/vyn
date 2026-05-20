---
title: Actions
description: The registry of callable things, discovered from the filesystem. createQuery and createMutation declare the primitives; file paths and export names define the API surface.
sidebar:
  order: 1
---

An **action** in Vyn is a typed record of intent: an input schema, an
output schema, and a function that runs. Actions live in an in-process
registry. Every callable surface — RPC, agent tools, CLI commands, queue
workers — reads from that registry. You write the action once; the
framework derives the surfaces.

Three primitives populate the registry: `createQuery`, `createMutation`,
and `createSubscription`. The filesystem decides where each action lands
on every surface — no barrel to maintain, no `name` to keep in sync
with a path.

## A complete example

```
features/
├── greet.actions.ts                          rpc.greet
└── notes/
    ├── notes.actions.ts                      rpc.notes.list
    │                                         rpc.notes.create
    └── categories/
        └── category.actions.ts               rpc.notes.categories.list
```

```ts
// features/greet.actions.ts
import { createQuery, v } from "@vyn/core";

export const greet = createQuery({
	description: "Say hello to someone.",
	input:  v.object({ name: v.string() }),
	output: v.string(),
	run: async opts => `Hello, ${opts.input.name}!`,
});
```

```ts
// features/notes/notes.actions.ts
import { createQuery, createMutation, createSubscription, v } from "@vyn/core";
import { NoteSchema } from "../models/note.ts";
import type { Note } from "../models/note.ts";

export const list = createQuery({
	description: "List notes for the current session.",
	input: v.object({ limit: v.number().min(1).max(100).default(50) }),
	output: v.array(NoteSchema),
	run: async opts => opts.ctx.db.notes
		.where({ userId: opts.ctx.session.userId })
		.orderBy("updatedAt", "desc")
		.limit(opts.input.limit)
		.all(),
});

export const onCreated = createSubscription({
	description: "Stream notes as they are created for the current user.",
	input:  v.object({}),
	output: NoteSchema,
	run: async function* (opts) {
		for await (const note of opts.events) {
			if (note.userId === opts.ctx.session?.userId) yield note;
		}
	},
});

export const create = createMutation({
	description: "Create a note.",
	input:  NoteSchema,
	output: NoteSchema,
	run: async opts => {
		const note = await opts.ctx.db.notes
			.insert(NoteSchema.create({ ...opts.input, userId: opts.ctx.session.userId }))
			.get();
		onCreated.emit(note);   // subscribers receive the new note; clients decide cache effect
		return note;
	},
});
```

```ts
// public/routes/index.ts
const notes = await rpc.notes.list.query({});
const fresh = await rpc.notes.create.mutate({ body: "hello" });
```

Three files, three RPC paths, zero wiring. The file system is the source
of truth.

## File-based discovery

The rule is one sentence: **every `*.actions.ts` file under the actions
root is discovered, the directory path becomes the namespace, and each
named export becomes a leaf.**

Concretely:

| File | Export | RPC path | Registry name |
|---|---|---|---|
| `features/greet.actions.ts`              | `greet`  | `rpc.greet`             | `greet` |
| `features/notes/notes.actions.ts`        | `list`   | `rpc.notes.list`        | `notes.list` |
| `features/notes/notes.actions.ts`        | `create` | `rpc.notes.create`      | `notes.create` |
| `features/notes/categories/category.actions.ts` | `list` | `rpc.notes.categories.list` | `notes.categories.list` |

### What the rule implies

- **File names are organizational, not addressable.** `notes.actions.ts`,
  `index.actions.ts`, and `category.actions.ts` are equivalent for
  discovery — only the directory path and the export name matter. Name
  files however reads best for your team.
- **Named exports only.** A default export does not have a name; the rule
  cannot bind it. The codegen step errors loudly on default exports.
- **Path collisions are errors at codegen time.** Two files in the same
  directory that both `export const list = ...` will fail the build,
  with both file paths in the error.
- **Multiple actions per file are encouraged for cohesion.** Group a
  query and its sibling mutations in one file when they share a model.
- **Non-`.actions.ts` files are ignored.** Discovery matches by suffix,
  so `db.ts`, `session.ts`, and any other helper sitting next to an
  actions file is invisible — it's just a normal module you import by
  name. No `_` prefix needed inside `features/`.

### The actions root

By default, the actions root is `features/`. Files matching
`features/**/*.actions.ts` are discovered. Configure in `vyn.config.ts`
if your project prefers `app/`, `src/`, or another layout:

```ts
// vyn.config.ts
export default {
	actionsRoot: "app",
};
```

### Codegen output

A `_vyn.gen.ts` barrel sits next to your actions root. It imports
every action file, builds the RPC namespace tree, and exports both the
registry and the typed RPC route shape. You do not edit it. It rebuilds
on file changes during dev and as part of `vyn build`.

## The three primitives

```ts
import { createQuery, createMutation, createSubscription, v } from "@vyn/core";

export const list = createQuery({
	description: "...",
	input:  v.object({...}),          // optional; defaults to v.object({})
	output: v.object({...}),          // optional; inferred from run if omitted
	run: async opts => ...,
});

export const create = createMutation({
	description: "...",
	input:  v.object({...}),          // optional; defaults to v.object({})
	output: v.object({...}),          // optional; inferred from run if omitted
	run: async opts => ...,            // call onCreated.emit(value) on subscriptions inside
});

export const onCreated = createSubscription({
	description: "...",
	input:  v.object({...}),          // optional; defaults to v.object({})
	output: v.object({...}),          // optional; inferred from yield type if omitted
	run: async function* (opts) {
		// access check, then yield from opts.events (or anywhere else)
		for await (const event of opts.events) yield event;
	},
});
```

### Why three primitives, not one

Each represents a distinct semantic:

- **Query** — pure function from input to output; calling it twice
  returns the same answer; cacheable.
- **Mutation** — effectful, single result; calling it twice is
  meaningfully different from calling it once; may invalidate queries.
- **Subscription** — long-lived; yields many values over time; runs
  until cancelled or finished.

Three primitives make the semantic visible at every call site, at every
import line, and in the type system. There is no `effect: "read" | "write" | "stream"`
flag to misread or lie about. If your action streams, you write
`createSubscription`. The intent is in the name.

This also confines feature surface to the right primitive. Only
`createSubscription` exports `.emit()`; only `createSubscription` uses
an async generator. Queries and mutations expose only `.run()`. The
type system enforces each constraint.

## Shared anatomy

Both primitives accept these fields:

```ts
{
	description: "Human-readable purpose",  // recommended; required if `tool` is set
	input:       v.object({...}),           // optional; defaults to v.object({}) if omitted
	output:      v.object({...}),           // optional; required if `tool` is set
	run:         async opts => ...,         // required, does the work
	tool:        { ... },                   // optional, exposes to LLM surfaces (MCP, agents)
}
```

### `description`

A short sentence in human English. Surfaces that present actions to
humans or to language models (API docs, generated forms, agent tool
specs) lean on this. Required only when the action has a `tool` field —
LLM surfaces need it. Otherwise optional but strongly recommended for
anything that lands in generated docs.

### `input`

A validator built with `v.*`. **Optional** — if omitted, the framework
treats the input as `v.object({})` (empty object). For any action that
accepts meaningful input from the caller, declare the schema; the
validator exposes its JSON Schema form, which is what makes agent
tooling and form generation work without code generation.

```ts
// No input — opts.input is {} typed as Record<string, never>
export const ping = createQuery({
	description: "Health check.",
	output: v.string(),
	run: async () => "pong",
});

// Explicit input
export const greet = createQuery({
	description: "Say hello.",
	input:  v.object({ name: v.string() }),
	output: v.string(),
	run: async opts => `Hello, ${opts.input.name}!`,
});
```

See [Models](/guide/models/) for sharing schemas across actions.

### `output`

A validator describing the return shape. **Optional everywhere.**

When present:

- the return value is validated at runtime in development and stripped
  in production for performance,
- a JSON Schema is exported (powers OpenAPI generation, MCP tool specs,
  generated forms),
- the LLM-facing surfaces have a typed result contract.

When absent:

- the action's return type is whatever TypeScript infers from `run`'s
  return. Typed clients still see the full type end-to-end,
- there is no runtime validation of the return value,
- the action cannot be exposed as an LLM tool (`tool` requires a schema
  the model can read).

```ts
// Output validated and exported as JSON Schema.
output: NoteSchema,

// No output field; type is inferred from `run` and trusted at the boundary.
//   const note = await rpc.notes.create.mutate(...)  // typed as the return of run
```

A mutation with no `output` that genuinely returns nothing types as
`Promise<void>`. There is no `output: v.void()` to write — just omit
the field.

For **subscriptions**, `output` is optional — the yield type is
inferred from the async generator. We recommend declaring it for any
subscription that crosses a trust boundary or that needs an LLM-facing
surface.

### `progress` (optional)

A validator describing payloads streamed during a long call via
`opts.tick(...)`. Available on **queries, mutations, jobs, and
notifications** — any primitive whose `run` can take measurable time
and benefits from intermediate status. The final return is still a
single value (or void); progress events flow alongside it before the
final result arrives.

```ts
progress: v.union([
	v.object({ kind: v.literal("status"), message: v.string(), progress: v.number().optional() }),
	v.object({ kind: v.literal("text_delta"), text: v.string() }),
	v.object({ kind: v.literal("tool_call"), tool: v.string(), input: v.any() }),
	v.object({ kind: v.literal("tool_result"), tool: v.string(), output: v.any() }),
]),
```

`opts.tick(payload)` (see `run` below) validates against this schema
and surfaces to the client via the RPC client's `onTick` callback
or async iterator. Common shape across agent surfaces: a tagged
union of status / tool_call / tool_result / text_delta events.

If `progress` is omitted, `opts.tick()` accepts free-form
`{ message, progress?, data? }` and emits without validation.

See [Agents](/guide/agents/) for the full pattern.

### `run`

The function that does the work. Always async. Receives a single `opts`
argument with at least `opts.input` and `opts.ctx`:

```ts
run: async opts => {
	opts.input;  // validated, typed input
	opts.ctx;    // whatever the calling surface provides
}
```

- `opts.input` is the validated, typed input.
- `opts.ctx` is whatever the calling surface decided to provide. For RPC,
  it's the per-request context. For agents, it's the agent's task
  context. For tests and scripts, it's whatever you pass to `.run()`.
- `opts.tick(payload)` — emit a progress event during long-running
  work. Validates against the action's `progress` schema if declared.
  Callers receive ticks via the RPC client's `onTick` callback or
  the streaming async iterator. Available on every kind that runs in
  the foreground (query, mutation, job, notification); subscription's
  `yield` already covers its streaming case.
- Additional fields may be added on `opts` by specific surfaces (a job
  worker adds `opts.job` with `{ id, attempt, scheduledAt }`; an agent
  surface adds `opts.tool` with the inbound tool-call frame). Read
  them when you need them.

```ts
run: async (opts) => {
	opts.tick({ kind: "status", message: "Fetching…", progress: 0.1 });
	const data = await load();

	opts.tick({ kind: "status", message: "Processing…", progress: 0.6 });
	const result = await process(data);

	return result;
},
```

`opts` is preferred over destructuring at the parameter list because it
threads through `await someOtherAction.run(opts)` cleanly — no rebuilding
the object at every nested call.

`run` is the only field that takes a function. Everything else is data.

### `tool` (LLM surfaces)

When present, the action becomes a tool that LLM-driven surfaces — the
MCP server, the in-process agent, any future LLM consumer — can list
and invoke. When absent, the action is internal: callable from RPC, CLI,
and other actions, but invisible to language models.

The minimal form is `tool: {}`, which exposes the action with its own
`description`, `input`, and `output` used verbatim as the tool spec.

```ts
export const create = createMutation({
	description: "Create a note.",
	input:  NoteSchema,
	output: NoteSchema,
	tool: {},
	run: async opts => {
		const note = await opts.ctx.db.notes.insert(NoteSchema.create(opts.input)).get();
		onCreated.emit(note);
		return note;
	},
});
```

Pass fields to override defaults:

```ts
tool: {
	description?: string;       // override description for LLM context
	examples?:    Array<{ input: unknown; output?: unknown }>;
	category?:    string;       // group in tool lists ("notes", "users", "admin")
	dangerous?:   boolean;      // hint: surface should gate behind confirmation
	hidden?:      boolean;      // exposed but not listed (advanced opt-in)
}
```

LLM-facing surfaces vary in what they need. The `description` you write
for API docs is often terser than what an LLM benefits from — `tool.description`
lets you write a longer, more contextual version without polluting the
public-facing one. `examples` are dropped into the tool spec so the
model sees a concrete call shape.

```ts
export const create = createMutation({
	description: "Create a note.",
	input:  NoteSchema,
	output: NoteSchema,
	tool: {
		description:
			"Create a note for the current user. The note's `_id` and " +
			"timestamps are filled automatically — only `body` is required, " +
			"`title` defaults to 'New note' if omitted.",
		examples: [
			{ input: { body: "Pick up groceries" } },
			{ input: { title: "Daily standup notes", body: "..." } },
		],
		category: "notes",
	},
	run: async opts => {
		const note = await opts.ctx.db.notes.insert(NoteSchema.create(opts.input)).get();
		onCreated.emit(note);
		return note;
	},
});
```

**Opt-in by default.** Actions without a `tool` field are not exposed to
any LLM surface. Most actions are internal plumbing; tool exposure is a
conscious decision per action.

For dangerous mutations (deleting users, sending production emails), set
`tool.dangerous: true`. Surfaces should interpret this as "require user
confirmation before invoking" — exactly how that confirmation works is
the surface's concern. The MCP server might emit a marker; an in-process
agent might pause and ask.

## Reaching other actions

Actions talk to each other through **typed import references**. The
only server-to-client side-effect primitive is emitting on a
subscription. Cache decisions belong to the client; the server does
not invalidate caches.

```ts
import { onCreated } from "./notes.actions.ts";

export const create = createMutation({
	description: "Create a note.",
	input:  NoteSchema,
	output: NoteSchema,
	run: async opts => {
		const note = await opts.ctx.db.notes.insert(NoteSchema.create(opts.input)).get();
		onCreated.emit(note);    // active subscribers receive the new note
		return note;
	},
});
```

| Method | Available on | Effect |
|---|---|---|
| `.run(opts)` | every action | invoke directly (tests, scripts, nested calls) |
| `.emit(value)` | subscriptions | push a value to that subscription's `opts.events` stream |

There is no `.invalidate()` server-side. There is no `invalidates: [...]`
metadata field on `createMutation`. Mutations do their work, emit the
relevant subscription, and return. Each subscription's `run` decides
whether the event matters for the connected client; the client decides
whether the event matters for its cache.

See [Realtime](/guide/realtime/) for the full pattern: subscription
declaration, access checks inside `run`, filtering by input, and the
client-side `invalidateOn` / `updateOn` query options that translate
events into cache effects.

## Calling an action

Every action is directly callable. This is the canonical form; every
surface is a wrapper on top of it.

```ts
import { create } from "../features/notes/notes.actions.ts";

const note = await create.run({
	input: { body: "hello" },
	ctx:   { db: getDb(), session: testSession() },
});
```

Use this in:

- unit tests (no HTTP, no agent loop, just the function),
- scripts, migrations, seed data,
- background workers triggered by a queue.

The input is validated. If you pass the wrong shape, `.run()` throws a
validation error before `run` ever executes.

## Surfaces

### RPC

The RPC surface filters the registry and exposes each entry as a typed
client method. Queries become `.query()`; mutations become `.mutate()`.
The path mirrors the registry name (which mirrors the file path).

```ts
// client
const notes  = await rpc.notes.list.query({ limit: 20 });
//    ^? Note[]
const fresh  = await rpc.notes.create.mutate({ body: "there" });
//    ^? Note

const cat = await rpc.notes.categories.list.query({});
//    ^? Category[]
```

The RPC path is the registry name — there is no separate override. To
change the path, rename or move the action file. [RPC](/guide/rpc/)
covers the surface in detail.

### MCP server

The Model Context Protocol surface mounts on the same HTTP server as
your RPC API — one process, one port, one deploy. Enable it in
`serve()`:

```ts
serve({ port: 8000, mcp: true });
```

The MCP HTTP endpoint is now reachable at `/mcp`, sharing the same
context factory, database pool, and session store as `/rpc`. Every
action with a `tool` field becomes an MCP tool; the JSON Schema from
`input` becomes the tool's parameter schema, `tool.description` (or
`description`) is what the model sees, and `tool.examples` are inlined
into the tool spec.

For local clients that expect a stdio subprocess (Claude Desktop), run:

```sh
vyn mcp --stdio
```

Same app, same registry, stdio transport instead of HTTP. [MCP](/guide/mcp/)
covers the full surface.

### In-process agent

`@vyn/agent` runs an LLM loop server-side with the registry as its
toolbelt. Use it from a route handler, a job worker, or another action
to build agentic features into your app without leaving the Vyn surface.

```ts
import { createAgent } from "@vyn/agent";
import { registry } from "@vyn/core";

const agent = createAgent({
	model: "claude-opus-4-7",
	tools: registry.byTool({ category: "notes" }),
});

const result = await agent.run({
	ctx,
	prompt: "Summarize the three most recent notes.",
});
```

Tools come from the same `tool` definitions. Agents respect
`tool.dangerous` by pausing for confirmation. [Agents](/guide/agents/)
and [MCP](/guide/mcp/) cover these surfaces in detail (coming).

### CLI

```sh
vyn run notes.create --body=hello
vyn run notes.categories.list
```

The CLI iterates the registry, exposes each action as a subcommand, and
generates argument parsing from the input schema. Works for queries and
mutations identically.

### Custom

The registry is exported. Build your own surface in app code:

```ts
import { registry } from "@vyn/core";

for (const action of registry.list()) {
	console.log(action.kind, action.name, action.input.schema);
}
```

This is how the framework's built-in surfaces work. There is nothing
privileged about them. If you want an admin UI that renders a "try it"
form for every mutation, or a CI check that diffs the registry against
the last release, you read the same data they do.

## The registry

The registry is the in-process record of every action declared by the
app. It rebuilds on hot reload. It's a plain object; you can read it.

```ts
import { registry } from "@vyn/core";

registry.list();                  // → Action[]
registry.get("notes.create");     // → Action | undefined
registry.byKind("query");         // → Action[] of kind === "query"
registry.byKind("mutation");      // → Action[] of kind === "mutation"
registry.byTool();                // → Action[] where tool !== undefined
registry.byTool({ category: "notes" });   // → Action[] filtered by tool.category
registry.schema();                // → bundle of all input/output schemas as JSON
```

Each entry looks like:

```ts
type ToolSpec = {
	description?: string;
	examples?:    Array<{ input: unknown; output?: unknown }>;
	category?:    string;
	dangerous?:   boolean;
	hidden?:      boolean;
};

type Action =
	| {
		kind: "query";
		name: string;                  // dot-separated; derived from file path + export
		description?: string;
		input?: Schema<unknown>;     // defaults to v.object({}) if omitted
		output?: Schema<unknown>;
		tool?: ToolSpec;
		run: (opts: { input: unknown; ctx: unknown; [k: string]: unknown }) => Promise<unknown>;
	}
	| {
		kind: "mutation";
		name: string;
		description?: string;
		input?: Schema<unknown>;     // defaults to v.object({}) if omitted
		output?: Schema<unknown>;
		tool?: ToolSpec;
		run: (opts: { input: unknown; ctx: unknown; [k: string]: unknown }) => Promise<unknown>;
	}
	| {
		kind: "subscription";
		name: string;
		description?: string;
		input?: Schema<unknown>;     // defaults to v.object({}) if omitted
		output?: Schema<unknown>;
		tool?: ToolSpec;
		run: (opts: {
			input: unknown;
			ctx: unknown;
			events: AsyncIterable<unknown>;
			signal: AbortSignal;
		}) => AsyncGenerator<unknown>;
	};
```

The `name` field is **read-only** from your perspective — codegen
populates it from the file path + export name. You never write it. The
`kind` discriminator is the only thing surfaces need to switch on.

## Patterns

### Actions calling actions

Import the export and call its `.run()`. No special composition primitive.

```ts
// features/notes/notes.actions.ts
import { list as catList } from "./categories/category.actions.ts";

export const summary = createQuery({
	description: "Notes with a per-category count.",
	input: v.object({}),
	output: v.object({ total: v.number(), byCategory: v.array(...) }),
	run: async opts => {
		const cats  = await catList.run(opts);
		const notes = await list.run(opts);
		return { total: notes.length, byCategory: rollup(notes, cats) };
	},
});
```

Each nested `.run()` validates input again. The cost is small; the
guarantee is that every caller sees the same validated shape.

### Authorization

Authorization is not an action field. It belongs to a layer that runs
before the action and may decline to invoke it. See [Guards](/guide/guards/)
(coming) for the pattern. Until that page lands, do the check inside
`run` — the action is still the single source of truth, and the check
runs uniformly across every surface.

### Long-running actions

If `run` would take longer than a single request can hold, write a
mutation that enqueues itself rather than executing inline. The action's
registry name is the queue job key. The queue runner is a custom surface
consuming the registry; see [Background work](/guide/background/) (coming).

## See also

- [Models](/guide/models/) — shared schemas referenced by actions
- [RPC](/guide/rpc/) — the typed client built from the registry
- [Realtime](/guide/realtime/) — cache invalidation and subscriptions

---
title: Realtime
description: Subscriptions are async generators with typed input, typed output, and inline access checks. Clients decide what events mean for their caches.
sidebar:
  order: 5
---

"Realtime" in most frameworks bundles two concepts: live queries that
refetch when data changes, and streams that push events as they
happen. Vyn keeps them separate, and the split goes deeper than it
might first appear: **only the client knows about caches**. The server
emits events; the client decides what those events mean.

This page covers subscriptions (the server side) and then the client
patterns that consume them.

## The shape

| Concern | Where it lives | How |
|---|---|---|
| Defining a stream              | `createSubscription` with `input`, `output`, `run` | `run` is an async generator that yields validated values |
| Pushing an event               | `subscription.emit(value)` from a mutation         | adds the value to that subscription's incoming queue |
| Consuming events in a stream   | `for await (const event of opts.events)` in `run` | filter, transform, decide what to yield |
| Access control                 | inline in `run`                                   | `requireSession(opts)`, custom checks, throw `RpcError` to refuse |
| Cache effects (client side)    | `invalidateOn` / `updateOn` query options         | client decides what each event means for its cache |

The server does not say "invalidate the list." The server says "a
thing happened, here's the payload." The client decides whether that
means refetching, splicing into a local list, ignoring, or animating
a toast.

## A complete example

```ts
// features/threads/threads.actions.ts
import { createQuery, createMutation, createSubscription, v, RpcError } from "@vyn/core";
import { requireSession } from "../auth/guards.ts";
import { MessageSchema, type Message } from "./message.ts";

async function userCanAccessThread(opts: { ctx: Ctx & { session: Session } }, threadId: string) {
	return opts.ctx.db
		.prepare("SELECT 1 FROM thread_members WHERE threadId = ? AND userId = ?")
		.get(threadId, opts.ctx.session.userId) != null;
}

export const onMessages = createSubscription({
	description: "Stream messages on a thread.",
	input:  v.object({ threadId: v.string().uuid() }),
	output: MessageSchema,
	run: async function* (opts) {
		requireSession(opts);
		if (!(await userCanAccessThread(opts, opts.input.threadId))) {
			throw new RpcError("forbidden", "not a member of this thread");
		}

		for await (const msg of opts.events) {
			if (msg.threadId === opts.input.threadId) yield msg;
		}
	},
});

export const post = createMutation({
	description: "Post a message to a thread.",
	input:  MessageSchema.pick(["threadId", "body"]),
	output: MessageSchema,
	run: async opts => {
		requireSession(opts);
		if (!(await userCanAccessThread(opts, opts.input.threadId))) {
			throw new RpcError("forbidden", "not a member of this thread");
		}

		const msg = MessageSchema.create({
			...opts.input,
			authorId: opts.ctx.session.userId,
		});
		opts.ctx.db
			.prepare("INSERT INTO messages (_id, threadId, authorId, body, createdAt) VALUES (?, ?, ?, ?, ?)")
			.run(msg._id, msg.threadId, msg.authorId, msg.body, msg.createdAt);

		onMessages.emit(msg);
		return msg;
	},
});
```

Things to notice:

- The subscription declares its **input** like any other action — query
  params the client sends when subscribing.
- The **`run` body owns access control**. A user who isn't a member of
  the thread gets `forbidden` before any messages flow.
- `opts.events` is an async iterable of values pushed via
  `onMessages.emit(...)`. The generator filters by the subscribed
  `threadId` and yields only matches.
- Each `yield` validates against `output`. A malformed event ends the
  subscription with a server-side `internal` error.
- The mutation does the access check too — at the door, where the
  user posts. Subscription and mutation share the same check via a
  helper function; both surfaces fire it identically.

## Anatomy

```ts
{
	description: "...",
	input:  v.object({...}),       // optional; defaults to v.object({}). query params subscriber sends
	output: v.object({...}),       // optional; yielded values validate when present
	run:    async function* (opts) {
		// access check, then yield from opts.events (or anywhere else)
	},
	tool:   { ... },               // optional, exposes to streaming-aware LLM surfaces
}
```

`opts` carries:

- `opts.input`   — validated, typed input
- `opts.ctx`     — per-connection context (built once at upgrade time)
- `opts.events`  — async iterable of values emitted via `thisSubscription.emit(...)`
- `opts.signal`  — `AbortSignal`; fires when the client disconnects

`run` is an **async generator** (`async function* (opts) { yield ... }`).
There is no declarative-filter form; if you want to filter, filter
inside `run`. If you want to attach a snapshot on connect, yield
snapshot values before entering the event loop.

## Why no declarative `match`

An earlier draft of Vyn had a `match: (input, event, ctx) => boolean`
field for the common "broadcast and filter" case. We dropped it because:

- Access control belongs next to access. With `match`, auth checks
  end up split between `match` (early reject) and an `RpcError`-throwing
  helper (late reject). Inline `run` puts them together.
- Filtering by input is a one-liner inside `run`. The "saved code"
  was literally one `if`.
- Subscriptions that need a snapshot-then-stream pattern were already
  using `run`. Two forms meant two patterns to know.
- Errors from `match` had no place to land; errors from `run` use the
  standard `RpcError` mechanism every other action uses.

One form, no special filter primitive. Same shape as tRPC subscriptions.

## Snapshots and computed streams

`run` can yield anything before it starts consuming events. Send a
snapshot, run a computed window, mix multiple sources:

```ts
export const onMessages = createSubscription({
	description: "Stream messages, including the last 20 on connect.",
	input:  v.object({ threadId: v.string() }),
	output: MessageSchema,
	run: async function* (opts) {
		requireSession(opts);
		// ... access check ...

		// Snapshot on connect.
		const recent = opts.ctx.db
			.prepare("SELECT * FROM messages WHERE threadId = ? ORDER BY createdAt DESC LIMIT 20")
			.all(opts.input.threadId) as Message[];
		for (const msg of recent.reverse()) yield msg;

		// Live tail.
		for await (const msg of opts.events) {
			if (msg.threadId === opts.input.threadId) yield msg;
		}
	},
});
```

The client doesn't see the join — it gets a sequence of validated
values from oldest to newest, and the rest of the realtime flow is
identical.

## Mutations emit

The only thing mutations need to know about subscriptions is the
import + the `.emit(value)` call. The framework routes the value into
`opts.events` of every active subscription with that typed reference.

```ts
import { onMessages } from "./threads.actions.ts";

export const post = createMutation({
	// ...
	run: async opts => {
		const msg = /* ... */;
		onMessages.emit(msg);   // every active onMessages subscriber's run sees this in opts.events
		return msg;
	},
});
```

Multiple subscriptions can emit to themselves; nothing prevents
`onMessages` and `onSystem` from emitting different shapes. Each typed
reference is its own channel.

## Cache invalidation (client side)

The client cache is shaped by two events:

1. **A mutation completed.** The client received its return value. If
   that value is what your local cache needs, splice it in. If not,
   refetch the affected queries.
2. **A subscription delivered a value.** The client decides what the
   value means. The same event can mean different things to different
   queries.

Both decisions live where the cache lives: the client.

### Refetch on event

```ts
const { data } = useQuery(rpc.threads.list, {}, {
	invalidateOn: [rpc.threads.onMessages],
});
```

The client opens a subscription to each listed channel for the
lifetime of the query. Any value arriving on that subscription causes
the cache entry to drop and refetch.

### Update in place

For events that carry enough information to patch the cache locally:

```ts
const { data } = useQuery(rpc.threads.messages, { threadId }, {
	updateOn: [
		{ subscription: rpc.threads.onMessages, fn: (msgs, m) => [...msgs, m] },
	],
});
```

`updateOn.fn` receives the cached value and the event. The return is
written back to the cache. No network round-trip.

## Multi-instance deployments

In a single process, the default in-memory transport delivers `emit()`
calls to every active subscription instance locally. Across instances
(or for data-source-derived events, durable delivery, or cross-cutting
observability), swap the transport:

```ts
import { serve } from "@vyn/server";
import { redisTransport } from "@vyn/transport-redis";

serve({
	port: 8000,
	transport: redisTransport({ url: env.REDIS_URL }),
});
```

Your `subscription.emit(...)` calls do not change. The transport
adapter handles cross-instance fan-out keyed by the subscription's
registry name. Vyn ships transports for Redis, NATS, Postgres
LISTEN/NOTIFY, MongoDB change streams, Postgres logical replication,
Kafka, Redis Streams, and NATS JetStream — see [Transport](/vyn/guide/transport/)
for the full set, composable wrappers (logging, retry, multi-backend
fan-out), and how to write a custom one.

## File-based discovery

Subscriptions live in the same `*.actions.ts` files as queries and
mutations and follow the same path convention.

| File | Export | Client path |
|---|---|---|
| `features/threads/threads.actions.ts` | `onMessages` | `rpc.threads.onMessages.listen(...)` |

## Authorization

The access check runs inside `run`, before any yield. If the user
loses auth mid-stream, the WS connection closes and `opts.signal`
fires. The async generator's `finally` block (if any) runs for
cleanup.

```ts
run: async function* (opts) {
	requireSession(opts);
	try {
		for await (const msg of opts.events) yield msg;
	} finally {
		// cleanup that should happen on any termination
	}
},
```

[Guards](/vyn/guide/guards/) covers the inline-helper pattern.

## Presence

Vyn does not ship a presence primitive. Presence is app-specific
(who's online? per-thread? per-document?) and easy to build from
`subscription.emit` plus a heartbeat. The [Build a chat](/vyn/tutorials/build-a-chat/)
tutorial (coming) implements it.

## Open questions

- **Streaming MCP tools.** MCP supports streaming responses in some
  transports. Whether `tool: { ... }` should extend to subscriptions
  for partial-result streaming is open.
- **Backpressure on `emit`.** A slow subscriber currently delays only
  itself. Whether a slow consumer should ever apply backpressure
  upstream is open.
- **Replay / cursors.** Subscriptions are fire-and-forget. Recovering
  missed events after a disconnect is on the roadmap; for now, the
  snapshot-then-stream pattern in `run` is the workaround.

## See also

- [Actions](/vyn/guide/actions/) — the registry, the three primitives, the typed `.emit()` on subscriptions
- [Guards](/vyn/guide/guards/) — inline access checks shared between mutations and subscriptions
- [Errors](/vyn/guide/errors/) — `RpcError` thrown from `run`, surfaced to the client

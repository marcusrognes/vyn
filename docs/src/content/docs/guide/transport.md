---
title: Transport
description: How subscription events move between processes. One small interface; multiple backends — in-memory, Redis, NATS, MongoDB oplog, Postgres LISTEN/NOTIFY, Kafka. Composable wrappers for logging and filtering.
sidebar:
  order: 6
---

When a mutation calls `subscription.emit(value)`, the event needs to
reach every active subscriber — possibly across instances, possibly
durably, possibly derived from a database change. Vyn handles all of
this through one small interface: **the transport**. Pick a transport
that matches the deployment shape; the rest of your code does not
change.

## The interface

```ts
export interface Transport {
	publish(name: string, value: unknown): void | Promise<void>;
	subscribe(name: string, handler: (value: unknown) => void): () => void;
	close?(): void | Promise<void>;
}
```

- **`name`** is the subscription's registry name — `notes.onCreated`,
  `threads.onMessages`, derived from the file path. Same key on both
  sides; no topic-string drift.
- **`publish(name, value)`** delivers `value` to every active local
  `subscribe(name, ...)` and forwards across processes if the transport
  spans multiple nodes.
- **`subscribe(name, handler)`** registers a local listener and
  returns an unsubscribe function the framework calls on disconnect.
- **`close()`** runs on graceful shutdown — close pools, flush
  buffers, drop connections.

The framework calls `transport.publish(...)` inside `subscription.emit(...)`
and `transport.subscribe(...)` when a subscription's `run` starts
consuming `opts.events`. Apps never call the transport directly.

## Configuration

```ts
// server.ts
import { serve } from "@vyn/server";
import { redisTransport } from "@vyn/transport-redis";

serve({
	port: Number(env.PORT),
	transport: redisTransport({ url: env.REDIS_URL }),
});
```

Omit the field and Vyn uses `inMemoryTransport()` — a synchronous Map
of listeners. Fast, fine for development and single-process
production, no extra dependencies.

## Built-in transports

Vyn ships a small set of transports as separate packages so you only
pay for what you import.

### `inMemoryTransport()` (default)

```ts
import { inMemoryTransport } from "@vyn/core";

serve({ transport: inMemoryTransport() });  // explicit; same as omitting
```

- Single process. No external dependencies.
- Synchronous: `publish` returns before all handlers finish (unless a
  handler awaits internally).
- Listeners are tracked in a `Map<name, Set<handler>>`.
- Preserved across HMR reloads in dev mode — subscriptions don't drop
  when a file changes.

When to use: dev, single-instance production, anything that doesn't
need to fan out across nodes.

### Pub/sub transports

Standard publish/subscribe protocols. Every node subscribes to every
relevant name; publishes broadcast.

| Package | Backend | Notes |
|---|---|---|
| `@vyn/transport-redis` | Redis pub/sub | Lowest latency, no durability |
| `@vyn/transport-nats`  | NATS          | Lower-latency than Redis, optional auth |
| `@vyn/transport-postgres` | Postgres LISTEN/NOTIFY | Reuses your existing DB connection |

```ts
import { redisTransport } from "@vyn/transport-redis";
serve({ transport: redisTransport({ url: env.REDIS_URL, prefix: "myapp" }) });

import { natsTransport } from "@vyn/transport-nats";
serve({ transport: natsTransport({ servers: env.NATS_URL.split(",") }) });

import { postgresTransport } from "@vyn/transport-postgres";
serve({ transport: postgresTransport({ url: env.DATABASE_URL }) });
```

All three implement the `Transport` interface identically. Swap one
for another by changing the import — your subscription `emit` calls
do not change.

When to use: multi-instance deployments where you want events to fan
out across nodes but don't need durability or replay.

### Data-source transports

The data layer itself is the event source. Mutations don't need to
call `.emit()` — the database's write-ahead log (or change stream, or
logical replication slot) produces events, and the transport maps
them to subscription names.

```ts
import { mongoOplogTransport } from "@vyn/transport-mongo";
import { onCreated, onUpdated, onDeleted } from "./features/notes/notes.actions.ts";

serve({
	transport: mongoOplogTransport({
		url: env.MONGO_URL,
		mappings: [
			{ collection: "notes", op: "insert", emits: onCreated },
			{ collection: "notes", op: "update", emits: onUpdated, transform: doc => doc.fullDocument },
			{ collection: "notes", op: "delete", emits: onDeleted, transform: doc => doc.documentKey },
		],
	}),
});
```

The `emits` reference is the typed subscription. Renaming or moving
the subscription updates this mapping at the type level — the wire is
the registry name regardless. `transform` shapes the raw change-stream
document into the subscription's `output` shape.

For events that aren't data-derived (a chat user typing, a presence
heartbeat), data-source transports fall back to a parallel pub/sub
channel — mutations still call `.emit()` and it works as expected.

| Package | Source |
|---|---|
| `@vyn/transport-mongo` | MongoDB change streams (replica set required) |
| `@vyn/transport-postgres-cdc` | Postgres logical replication |

When to use: apps where most realtime events ARE data changes. The
mutation side simplifies; the DB becomes the source of truth for "did
this happen?"

### Durable transports

Same `publish` / `subscribe`, but the transport persists events. Late
subscribers can replay from an offset; downtime doesn't drop events.

```ts
import { kafkaTransport } from "@vyn/transport-kafka";

serve({
	transport: kafkaTransport({
		brokers: env.KAFKA_BROKERS.split(","),
		replayFromConnect: "last-hour",   // or "earliest" | "none" | { offset: ... }
	}),
});
```

The subscription's `run` receives replayed events the same as live
ones — `opts.events` does not distinguish. For apps that care about
the difference, an optional per-event marker lands on the value:

```ts
for await (const event of opts.events) {
	if (event._meta?.replay) /* ... */;
	yield stripMeta(event);
}
```

| Package | Backend | Replay model |
|---|---|---|
| `@vyn/transport-kafka` | Kafka | Offset-based, durable |
| `@vyn/transport-redis-streams` | Redis Streams | Consumer-group ack, capped retention |
| `@vyn/transport-nats-jetstream` | NATS JetStream | Stream-based, configurable retention |

When to use: apps that cannot lose events on restart or network blip,
or that want "show me what happened in the last hour" on reconnect.

## Composable wrappers

A wrapper is a `Transport` that takes another `Transport` and
modifies the behavior. Useful for cross-cutting concerns without
modifying the underlying implementation.

### `logged(transport, opts)`

Records every publish and subscribe to a sink. Lightweight observability.

```ts
import { logged } from "@vyn/core";

serve({
	transport: logged(redisTransport({ url }), {
		sink: (e) => logger.info({ kind: "subscription.event", ...e }),
		include: ["publish", "subscribe", "unsubscribe"],
	}),
});
```

### `filtered(transport, predicate)`

Drops publishes (or deliveries) not matching a predicate. Per-tenant
routing, debug toggles, feature flags.

```ts
import { filtered } from "@vyn/core";

serve({
	transport: filtered(redisTransport({ url }), {
		publish:   (name, value) => isAllowedForTenant(name, value),
		subscribe: (name, ctx)   => ctx.tenant?.realtime !== false,
	}),
});
```

### `withRetry(transport, opts)`

Retries publishes with backoff. The transport's failure semantics
become eventual-success for transient errors.

```ts
import { withRetry } from "@vyn/core";

serve({
	transport: withRetry(redisTransport({ url }), {
		maxAttempts: 5,
		backoffMs:   (attempt) => Math.min(100 * 2 ** attempt, 5_000),
	}),
});
```

### `multi(...transports)`

Fan-out to multiple backends. Useful for "Redis for fast fan-out, also
log to Kafka for audit/replay."

```ts
import { multi } from "@vyn/core";

serve({
	transport: multi(
		redisTransport({ url: env.REDIS_URL }),
		kafkaTransport({ brokers: env.KAFKA_BROKERS.split(",") }),
	),
});
```

Publishes go to every transport. Subscribes register on every
transport; the first one to deliver wins (`once`-style dedup is the
caller's job if they care).

Wrappers compose freely:

```ts
serve({
	transport: logged(
		withRetry(
			multi(
				redisTransport({ url: env.REDIS_URL }),
				kafkaTransport({ brokers: env.KAFKA_BROKERS.split(",") }),
			),
			{ maxAttempts: 3 },
		),
		{ sink: console.log },
	),
});
```

## Writing a custom transport

Implement the three-method interface. Vyn does not impose any
constraints on serialization, ordering, or durability — the transport
is the source of truth for those properties.

```ts
import type { Transport } from "@vyn/core";

export function memcachedTransport(opts: { servers: string[] }): Transport {
	// hypothetical example — memcached lacks pub/sub natively, so this
	// would need polling. Just a shape demonstration.
	const listeners = new Map<string, Set<(v: unknown) => void>>();
	let timer: ReturnType<typeof setInterval> | undefined;
	const client = createMemcachedClient(opts.servers);

	function startPolling() {
		if (timer) return;
		timer = setInterval(async () => {
			for (const name of listeners.keys()) {
				const items = await client.dequeue(name);
				for (const v of items) listeners.get(name)?.forEach(fn => fn(v));
			}
		}, 100);
	}

	return {
		publish(name, value) {
			return client.enqueue(name, value);
		},
		subscribe(name, fn) {
			if (!listeners.has(name)) listeners.set(name, new Set());
			listeners.get(name)!.add(fn);
			startPolling();
			return () => listeners.get(name)?.delete(fn);
		},
		async close() {
			if (timer) clearInterval(timer);
			await client.disconnect();
		},
	};
}
```

The transport package can ship its own configuration shape; only the
three methods are framework-visible.

## Delivery semantics

Vyn does not enforce or guarantee any delivery semantics — those come
from the transport you choose:

| Transport family | Delivery | Ordering |
|---|---|---|
| `inMemoryTransport` | At-most-once | Per-publish order, single thread |
| Pub/sub (Redis, NATS, Postgres) | At-most-once | Per-publisher order; no cross-publisher ordering |
| Data-source (MongoDB oplog, Postgres CDC) | At-least-once (with resume token) | Replication-log order |
| Durable (Kafka, Streams, JetStream) | At-least-once | Per-partition order, configurable |

Your subscription `run` should be **idempotent** when using
at-least-once transports — a value may arrive twice if a consumer
restarted between receive and ack. Most realtime UIs are naturally
idempotent (replacing the same DOM with the same data is fine);
mutations triggered by subscriptions need explicit dedup.

## Multi-tenant routing

For apps where every event belongs to a tenant, two options:

**1. Per-tenant names.** Prefix the subscription name at boot, so
tenant A and tenant B never share a topic:

```ts
serve({
	transport: filtered(redisTransport({ url }), {
		nameOf: (name, ctx) => ctx.tenantId ? `${ctx.tenantId}.${name}` : name,
	}),
});
```

The cost: every active tenant adds one subscription per topic. Fine
for hundreds of tenants, expensive for thousands.

**2. Filter in `match` inside `run`.** Use a single topic, filter on
the subscriber side. Cheaper at scale but every node sees every
tenant's events.

The trade-off is "fewer subscriptions, more delivered-then-discarded
events" vs "more subscriptions, less wasted bandwidth." Pick per the
shape of your data.

## Lifecycle

The transport is built once during boot, before the server binds the
port. It lives for the lifetime of the process. On shutdown:

1. `serve()` calls `transport.close?()` after every WS connection has
   drained.
2. The framework awaits the close before exiting.
3. Subscriptions clean up their local handlers via the unsub returned
   from `transport.subscribe(...)`.

For long-lived transports (connection pools, change-stream cursors),
implement `close()` to release them. The framework will not exit
cleanly otherwise.

## HMR

In dev mode, the framework preserves the transport across module
reloads. Subscriptions opened by route modules are torn down and
re-opened when their files change, but the transport itself — and its
backing connection — stays. This means a Redis connection isn't
re-handshaked every time you save a file.

If your transport is sensitive to module re-imports (it holds a
reference to a re-loaded `env`, for example), close it explicitly in
the module's HMR dispose hook.

## Open questions

- **Backpressure across transports.** A slow Kafka publisher should
  apply backpressure to the mutation that called `.emit()`; the
  current interface doesn't expose this. Open whether `publish()`
  should return a Promise that resolves only when the transport
  considers the event delivered.
- **Ordering across emit + return.** `mutation.emit(); return value;`
  guarantees the value is published before the return reaches the
  client only for synchronous transports. For async transports, the
  client could in theory see the mutation response before the
  subscription event. The framework could optionally `await` the
  publish; the cost is latency.
- **Cross-transport replay.** Apps that want "Redis for live, Kafka
  for replay-from-last-hour-on-reconnect" don't have a clean
  primitive yet. `multi()` fans out publishes but doesn't route
  subscribes to the right backend.

## See also

- [Realtime](/guide/realtime/) — subscriptions and the `.emit()` shape
- [Configuration](/guide/configuration/) — `serve()` options
- [Actions](/guide/actions/) — the registry that produces transport names

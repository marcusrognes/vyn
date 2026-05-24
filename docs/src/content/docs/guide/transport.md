---
title: Custom transports
description: One global EventTransport interface on serve() — wire subscription.emit() to any pub/sub backend (Redis, NATS, Postgres LISTEN/NOTIFY, Kafka). Framework handles dedup, dispatch, and per-event-name routing.
sidebar:
    order: 6
---

`subscription.emit(value)` is in-process by default. Every active subscriber on the current Deno instance receives the value via a local
queue. To fan out across instances — multiple Deno processes behind a load balancer, blue/green deploys, anywhere you need every subscriber
to see every emit regardless of which node received the mutation — pass an `EventTransport` to `serve()`.

One global transport handles every subscription. The framework hands it the event name and value; the transport decides how to shuttle bytes
(one channel per name, one channel for all, sharded buckets — the transport's call).

## The interface

```ts
import type { EventTransport } from "@vynjs/server";

export type EventTransport = {
	publish(name: string, value: unknown): void | Promise<void>;
	subscribe(
		deliver: (name: string, value: unknown) => void,
	): (() => void | Promise<void>) | Promise<() => void | Promise<void>>;
	close?(): void | Promise<void>;
};
```

- **`publish(name, value)`** — called once per local `subscription.emit(value)`. Forward to your broker; do not call the local subscribers,
  the framework already did.
- **`subscribe(deliver)`** — called once at boot. The transport must subscribe to whatever it needs from the broker; for every message it
  receives from another process, call `deliver(name,
  value)` and the framework will route to the right subscription's local queues.
  Returns an unsubscribe function (sync or async).
- **`close?()`** — called during `handle.close()`. Drain connections, flush buffers.

The framework wraps every `publish` call in a `{ from, payload }` envelope and tags each instance with a unique id. Messages tagged with the
local id are ignored on receive — no double-emit on the origin instance.

## Wiring it up

```ts
// server.ts
import { serve } from "@vynjs/server";
import { redisTransport } from "./lib/redis-transport.ts";
import "./_vyn.gen.ts";

await serve({
	port: 8000,
	transport: redisTransport({ url: Deno.env.get("REDIS_URL")! }),
});
```

No changes to action code. `subscription.emit(value)` continues to work; the transport runs in parallel.

## Redis pub/sub example

A single-channel implementation: every event flows through one Redis channel with the event name in the payload. Trade-off vs
channel-per-name: simpler, but every node receives every event and filters in the framework. Fine for hundreds of subscriptions, less fine
for thousands of channels.

```ts
// lib/redis-transport.ts
import { connect } from "jsr:@db/redis";
import type { EventTransport } from "@vynjs/server";

export function redisTransport(
	opts: { url: string; channel?: string },
): EventTransport {
	const channel = opts.channel ?? "vyn.events";
	let pub: Awaited<ReturnType<typeof connect>> | undefined;
	let sub: Awaited<ReturnType<typeof connect>> | undefined;

	return {
		async publish(name, value) {
			pub ??= await connect({ hostname: new URL(opts.url).hostname });
			await pub.publish(channel, JSON.stringify({ name, value }));
		},
		async subscribe(deliver) {
			sub = await connect({ hostname: new URL(opts.url).hostname });
			const iter = await sub.subscribe(channel);
			(async () => {
				for await (const { message } of iter.receive()) {
					try {
						const { name, value } = JSON.parse(message) as {
							name: string;
							value: unknown;
						};
						deliver(name, value);
					} catch (e) {
						console.warn("[redis-transport] decode failed:", e);
					}
				}
			})();
			return async () => {
				await sub?.close();
			};
		},
		async close() {
			await Promise.all([pub?.close(), sub?.close()]);
		},
	};
}
```

That's the entire integration. Drop it in `serve({ transport })` and every `.emit(...)` reaches every node.

## NATS / Postgres LISTEN/NOTIFY / Kafka

Same three methods, different client library:

- **NATS**: `publish(subject, data)` + `subscribe(subject, cb)`. Use one subject with name in payload, or one subject per name.
- **Postgres LISTEN/NOTIFY**: `NOTIFY vyn_events, '...'` for publish; `LISTEN vyn_events` for subscribe. Reuses your existing DB connection.
- **Kafka**: publish to a topic with the event name as the partition key; consumer group reads and calls `deliver(name,
  value)`. Buy
  at-least-once and offset replay.

## Delivery guarantees

Pub/sub is **at-most-once**. If the broker drops a message (subscriber not yet connected, network blip), it's gone. For realtime UIs this is
usually fine — the next event repaints; nobody notices.

For at-least-once, use a durable backend (Kafka, Redis Streams, NATS JetStream). The framework treats every event the same — your transport
ack/replay logic is internal to the transport.

If your subscription's `run` triggers side effects on each event, make those idempotent — at-least-once means a single emit can arrive twice
if the consumer restarted between receive and ack.

## Ordering

Per-publisher ordering is preserved by every common broker. Cross-publisher order is not guaranteed: if two instances emit at overlapping
times, the broker decides the merge order.

If your UI needs strict order, attach a monotonic sequence to the payload and resolve client-side. The framework will not.

## Multi-tenant routing

Two ways to keep tenant A's events away from tenant B's subscribers:

**1. Per-tenant event names.** Include the tenant id in the subscription name (`tenants.${id}.todos.watch`). The transport fans out as
usual; only subscribers on the right name see the events. Cheap for hundreds of tenants, expensive for thousands.

**2. Single name, filter in `run`.** Every node sees every tenant's events; the action's `run` drops events whose payload doesn't match the
request's tenant. Less subscription overhead, more delivered-then-discarded bandwidth.

Pick per the shape of your traffic.

## Lifecycle

The transport's `subscribe` runs **after** all `*.actions.ts` imports — `_vyn.gen.ts` populates the registry before `serve()` returns.
`publish` is wired the moment `serve()` is called, so any `emit` after that point reaches the transport.

On `handle.close()`:

1. Subscribe-side unsubscribe (returned from `subscribe`).
2. `transport.close?.()`.
3. The HTTP server shuts down.

For long-lived connections (pools, change-stream cursors), implement `close()` to release them. The framework awaits it before exiting.

## See also

- [Realtime](/vyn/guide/realtime/) — subscriptions and the `emit()` shape
- [Configuration](/vyn/guide/configuration/) — `serve()` options
- [Actions](/vyn/guide/actions/) — the registry that produces the event names

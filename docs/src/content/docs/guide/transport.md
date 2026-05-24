---
title: Custom transports
description: How to fan out subscription events across processes. Vyn's emit() is in-process; this guide shows how to bridge it to Redis pub/sub (or any other broker) without framework changes.
sidebar:
  order: 6
---

`subscription.emit(value)` is in-process. It pushes `value` onto
every active subscriber queue on the current Deno instance. That's
the entire shape Vyn ships today — no `Transport` interface, no
`serve({ transport })` option, no built-in adapters.

For most apps that's fine. Single Deno process, one WebSocket per
client, fan-out happens locally. When you need to run multiple
instances (load balancer, blue/green, scale-out behind Fly/Render),
you bridge `emit` to a broker yourself.

This guide builds that bridge with **Redis pub/sub** as the example.
The pattern transfers directly to NATS, Postgres LISTEN/NOTIFY,
Kafka — anything with a publish/subscribe primitive.

## The pattern

Two wires:

1. **Publish:** after every local `emit`, also publish to the broker.
2. **Subscribe:** on boot, subscribe to the broker; on each message
   received, call the local `emit` on the matching action.

The broker is the only thing that crosses processes. Local
`emit` continues to drive local queues — exactly as before — so
your action code does not change.

```
                ┌──────────────┐                ┌──────────────┐
   mutation ──► │  instance A  │ ── publish ──► │    Redis     │
                │  emit(value) │                │   pub/sub    │
                └──────┬───────┘                └──────┬───────┘
                       │                               │
                  local queues                    subscribe
                       │                               │
                       ▼                               ▼
                 client A's WS                ┌──────────────┐
                                              │  instance B  │
                                              │  emit(value) │
                                              └──────┬───────┘
                                                     │
                                                local queues
                                                     │
                                                     ▼
                                              client B's WS
```

## Step 1: define the subscription as usual

Nothing transport-specific. Action code is identical to the
single-process case.

```ts
// features/todos/todos.actions.ts
import { createSubscription, v } from "@vynjs/core";

const TodoSchema = v.object({
  id:    v.string(),
  title: v.string(),
  done:  v.boolean(),
});

export const watch = createSubscription({
  input:  v.object({}),
  output: TodoSchema,
  async *run({ events }) {
    for await (const todo of events) yield todo;
  },
});
```

## Step 2: write the bridge

A single module that knows about every action you want to fan out.
Each entry maps a registry name to the action's `emit` and to a
schema (so cross-process payloads are validated, not blindly
trusted).

```ts
// lib/transport-redis.ts
import { connect, type Redis } from "jsr:@db/redis";   // any Redis client
import { watch as todosWatch } from "../features/todos/todos.actions.ts";

// Every subscription that should fan out across instances.
// Add one entry per action.
const bridges = [
  { channel: "todos.watch", emit: todosWatch.emit, parse: (v: unknown) => todosWatch.output?.parse(v) ?? v },
] as const;

export type RedisTransport = {
  publish: (channel: string, value: unknown) => Promise<void>;
  close:   () => Promise<void>;
};

export async function startRedisTransport(url: string): Promise<RedisTransport> {
  const pub = await connect({ hostname: new URL(url).hostname });
  const sub = await connect({ hostname: new URL(url).hostname });
  const instanceId = crypto.randomUUID();

  // Listen on every bridge channel. Skip messages we sent (so we
  // don't double-emit on the originating instance — the local emit
  // already happened).
  for (const b of bridges) {
    const iter = await sub.subscribe(b.channel);
    (async () => {
      for await (const { message } of iter.receive()) {
        const env = JSON.parse(message) as { from: string; payload: unknown };
        if (env.from === instanceId) continue;
        b.emit(b.parse(env.payload));
      }
    })();
  }

  return {
    async publish(channel, value) {
      await pub.publish(channel, JSON.stringify({ from: instanceId, payload: value }));
    },
    async close() {
      await Promise.all([pub.close(), sub.close()]);
    },
  };
}
```

The `from` field on the envelope is the deduplication trick: the
instance that called `emit()` locally also publishes to Redis, then
**ignores** the echo when Redis delivers its own message back. Every
other instance treats the message as authoritative and calls its
local `emit()`.

## Step 3: wrap `emit` to also publish

You need every `action.emit(value)` to also hit Redis. The cleanest
spot is a wrapper at boot:

```ts
// lib/transport-redis.ts (continued)
export function wireEmit(transport: RedisTransport): void {
  for (const b of bridges) {
    const original = b.emit;
    // Re-bind in place. The action's `emit` is just a function ref;
    // we capture it, replace it with a publish-then-emit wrapper.
    (b as { emit: typeof original }).emit = (value) => {
      void transport.publish(b.channel, value);
      original(value);
    };
  }
}
```

A cleaner alternative if you control the action site: call
`transport.publish(...)` inside the mutation alongside `emit()`.
Slightly more boilerplate, no monkey-patching.

```ts
// features/todos/todos.actions.ts
import { transport } from "../../lib/transport-redis.ts";

export const add = createMutation({
  input:  v.object({ title: v.string().min(1) }),
  output: TodoSchema,
  async run({ input }) {
    const todo = { id: crypto.randomUUID(), title: input.title, done: false };
    todos.push(todo);
    watch.emit(todo);
    await transport.publish("todos.watch", todo);
    return todo;
  },
});
```

Pick one approach and stick with it. Mixing both will cause
double-emits.

## Step 4: boot the transport

```ts
// server.ts
import { serve } from "@vynjs/server";
import { startRedisTransport, wireEmit } from "./lib/transport-redis.ts";
import "./_vyn.gen.ts";

const transport = await startRedisTransport(Deno.env.get("REDIS_URL")!);
wireEmit(transport);

const handle = await serve({ port: 8000 });

Deno.addSignalListener("SIGTERM", async () => {
  await handle.close();
  await transport.close();
});
```

## Delivery guarantees

Pub/sub is **at-most-once**. If Redis drops the message (network
blip, subscriber not yet connected), it's gone — the broker does
not buffer or replay.

For at-least-once delivery, use Redis Streams, Kafka, or a database
log. Same shape: subscribe on boot → call local `emit` on each
message; publish after local `emit`. The bridge gains an
acknowledgment / offset step, the action code does not change.

## Ordering

Per-publisher ordering is preserved by every common broker.
Cross-publisher ordering is not — if two instances `emit` at
overlapping times, downstream order is the broker's call.

If your UI cares about strict order, attach a monotonic sequence
number to the payload and resolve on the client. The framework will
not.

## Multi-tenant routing

Two ways to keep tenant A's events from reaching tenant B's
subscribers:

1. **Per-tenant channel.** `bridges` becomes
   `{ channel: \`tenant-\${tenantId}.todos.watch\`, ... }`. One
   bridge per active tenant. Cheap when tenants count in hundreds.
2. **Filter in `run`.** Single channel, every node receives every
   tenant's events, the action's `run` drops events that don't
   match the request's tenant. Cheaper at scale.

The trade-off is fewer channels (less subscription overhead) vs
fewer delivered-then-discarded events (less wasted bandwidth). The
right answer depends on the shape of your data.

## When you outgrow this

If you find yourself wiring more than two or three transports, or
need composable wrappers (retry, observability, cross-backend
replay), the bridge will start to feel like a half-built framework
feature. Open an issue describing the shape — there's a real
chance it lands in `@vynjs/server` after enough real-world
patterns shake out.

## See also

- [Realtime](/vyn/guide/realtime/) — subscriptions and the `emit()` shape
- [Configuration](/vyn/guide/configuration/) — `serve()` options
- [Actions](/vyn/guide/actions/) — the registry that produces the names you bridge

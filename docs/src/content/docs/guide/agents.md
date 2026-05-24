---
title: Agents
description: Build LLM-driven features by composing existing primitives. Queries are the tools the agent reads, mutations are the tools it acts with, opts.tick streams thought + tokens, jobs run overnight, notifications close the loop.
sidebar:
    order: 10
---

Vyn does not ship a dedicated "agent" primitive. It doesn't need to — the existing five primitives plus `opts.tick(...)` cover everything a
complex agent does. This page walks through how they compose.

## The pieces an agent needs

| Need                                                  | Primitive                                                |
| ----------------------------------------------------- | -------------------------------------------------------- |
| Read data ("search notes", "fetch user")              | [`createQuery`](/vyn/guide/actions/) with `tool: ...`    |
| Act on data ("create note", "send email")             | [`createMutation`](/vyn/guide/actions/) with `tool: ...` |
| Stream thought / tokens / tool calls back to the user | Any action with `progress` schema + `opts.tick(...)`     |
| Stay on a long-running conversation                   | [`createSubscription`](/vyn/guide/realtime/)             |
| Run overnight / scheduled / retryable work            | [`createJob`](/vyn/guide/jobs/)                          |
| Reach the user across channels                        | [`createNotification`](/vyn/guide/notifications/)        |

Every one of those is already in the registry. Tag with `tool: {}` and the MCP server exposes them as JSON-schema'd tools any LLM client can
call. The in-process agent runner (`@vynjs/agent`) reads the same registry — no separate registration step.

## A complete agent

A "research assistant" that answers a question, calling tools to find information, streaming its thinking, and following up via notification
when it finishes long work:

```ts
// features/agent/agent.actions.ts
import { createMutation, createNotification, v } from "@vynjs/core";
import { createAgent } from "@vynjs/agent";
import { fetchPage, search } from "../research/research.actions.ts";

const Tick = v.union([
	v.object({ kind: v.literal("status"), message: v.string() }),
	v.object({ kind: v.literal("tool_call"), tool: v.string(), input: v.any() }),
	v.object({
		kind: v.literal("tool_result"),
		tool: v.string(),
		output: v.any(),
	}),
	v.object({ kind: v.literal("text_delta"), text: v.string() }),
]);

export const ask = createMutation({
	description: "Answer a question with optional tool use.",
	input: v.object({ question: v.string(), threadId: v.string().optional() }),
	output: v.object({ answer: v.string(), citations: v.array(v.string()) }),
	progress: Tick,
	tool: {},
	run: async (opts) => {
		const agent = createAgent({
			model: "claude-opus-4-7",
			tools: [search, fetchPage], // typed action references
			thread: opts.input.threadId,
		});

		const result = await agent.run({
			prompt: opts.input.question,
			ctx: opts.ctx,
			onEvent: (event) => opts.tick(event), // pipe agent events to the client
		});

		return result;
	},
});
```

Client side:

```ts
const promise = rpc.agent.ask.mutate(
	{ question: "What changed in Vyn this week?" },
	{
		onTick: (e) => {
			if (e.kind === "text_delta") output.textContent += e.text;
			if (e.kind === "tool_call") toolBadges.add(e.tool);
			if (e.kind === "status") setStatus(e.message);
		},
	},
);

const { answer, citations } = await promise;
```

That's a tool-using, streaming agent in roughly thirty lines.

## Where each primitive earns its keep

### Queries as tools the agent reads

```ts
export const search = createQuery({
	description: "Search the user's notes by content.",
	input:  v.object({ query: v.string() }),
	output: v.array(NoteSchema),
	tool:   { category: "research" },
	run:    async (opts) => /* ... */,
});
```

Marked `tool: ...`, this action appears in the agent's available tools (and via `/mcp` for any external MCP client). The agent calls it the
same way any other surface would. `requireSession` and other guards run identically.

### Mutations as tools the agent acts with

```ts
export const annotate = createMutation({
	description: "Add an annotation to a note.",
	input:  v.object({ noteId: v.string().uuid(), text: v.string() }),
	output: AnnotationSchema,
	tool:   { dangerous: false },
	run:    async (opts) => /* ... */,
});
```

Same shape. The `tool.dangerous` flag (when true) hints to the agent runner that the call should pause for user confirmation before
executing — the MCP surface exposes the same hint to external clients.

### `opts.tick()` for thought streaming

The mutation orchestrating the agent uses `opts.tick(...)` to stream the LLM's tool calls, tool results, status messages, and token deltas
back to the client _during_ the call. The final return is still the structured answer.

```ts
opts.tick({ kind: "status", message: "Searching…" });
opts.tick({ kind: "tool_call", tool: "search", input: { query: "X" } });
opts.tick({ kind: "tool_result", tool: "search", output: hits });
opts.tick({ kind: "text_delta", text: "Based on the results, " });
```

The `progress` schema on the action types these events. Clients react via `onTick` (callback) or async iterator (see
[Actions — `progress`](/vyn/guide/actions/#progress-optional)).

### Subscriptions for persistent agent threads

Long-running conversations live on a subscription so the client sees every message regardless of which window initiated it:

```ts
export const onMessage = createSubscription({
	description: "Stream messages on an agent thread.",
	input: v.object({ threadId: v.string() }),
	output: AgentMessage,
	run: async function* (opts) {
		requireSession(opts);
		for await (const msg of opts.events) {
			if (msg.threadId === opts.input.threadId) yield msg;
		}
	},
});
```

The `ask` mutation can `onMessage.emit(...)` for every message it produces; clients connected to the thread see them in real time, the
originating tab gets them too (via subscription, not just `opts.tick`).

### Jobs for overnight agent runs

For deep research that takes minutes (or hours), schedule the agent as a job:

```ts
export const deepResearch = createJob({
	description: "Slow, multi-tool deep research on a topic.",
	input: v.object({ topic: v.string(), userId: v.string() }),
	progress: Tick,
	retries: 2,
	timeout: 30 * 60 * 1000, // 30 minutes
	run: async (opts) => {
		opts.tick({ kind: "status", message: "Researching…" });
		const result = await deepAgent.run(opts);
		await opts.ctx.db.research.insert(result);
		researchReady.send({ userId: opts.input.userId, summary: result.summary });
	},
});
```

The user kicks it off via mutation, gets a job id back, and can `watch()` the job for progress events. When complete, the job itself fires a
notification.

### Notifications to close the loop

```ts
export const researchReady = createNotification({
	description: "A deep research run finished.",
	input: v.object({ userId: v.string(), summary: v.string() }),
	channels: {
		push: {
			mode: "instant",
			render: async (o) => ({
				title: "Research ready",
				body: o.input.summary.slice(0, 100),
			}),
		},
		email: {
			mode: "deferred",
			delay: 5 * 60 * 1000,
			render: async (o) => ({
				subject: "Research ready",
				html: `<p>${o.input.summary}</p>`,
			}),
		},
		inApp: {
			mode: "instant",
			render: async (o) => ({ kind: "research", summary: o.input.summary }),
		},
	},
});
```

Push fires immediately so the user sees the notification on their phone; in-app fires immediately for any open tab; email arrives in 5
minutes (giving the user a chance to engage with the live notification first, suppressing the email if they did).

## The in-process agent

`@vynjs/agent` is the runner that ties an LLM to the action registry.

```ts
import { createAgent } from "@vynjs/agent";

const agent = createAgent({
	model: "claude-opus-4-7",
	tools: registry.byTool({ category: "research" }), // filter the registry
	thread: threadId, // optional persistence key
	onEvent: (event) => opts.tick(event),
});

const result = await agent.run({
	prompt: opts.input.question,
	ctx: opts.ctx,
});
```

`agent.run` calls the LLM in a loop:

1. Send prompt + tool catalog (built from `tools`) to the model
2. Receive a response. If it includes tool calls, invoke each one via the action's `.run({ input, ctx })` and feed results back
3. Stream `text_delta` events via `onEvent` as tokens arrive
4. Honor `tool.dangerous: true` — pause for caller-provided confirmation before invoking
5. Return when the model produces a final answer

The agent is a thin shim — most of the work happens in your action implementations. The runner just handles the model loop and the event
plumbing.

## MCP for external agents

Everything tagged `tool: ...` is automatically reachable via the MCP server at `/mcp`. External clients (Claude Desktop, IDE plugins,
third-party agents) see the same tools your in-process agent does, with the same `progress` schemas, the same `dangerous` flags, the same
per-user auth.

```sh
vyn mcp --stdio    # for Claude Desktop config
# or
serve({ port: 8000, mcp: true })   # HTTP at /mcp
```

See [MCP](/vyn/guide/mcp/) for transport options and client config.

## Patterns this composes

| Pattern                                    | Composition                                                      |
| ------------------------------------------ | ---------------------------------------------------------------- |
| **Single-turn Q&A**                        | `createMutation` + `opts.tick`                                   |
| **Multi-tool reasoning**                   | mutation + `createAgent` + queries/mutations tagged `tool: ...`  |
| **Persistent chat thread**                 | mutation (per turn) + subscription (thread stream)               |
| **Long research, notify on completion**    | job + notification + tick for progress                           |
| **Confirmation before destructive action** | `tool.dangerous: true` on the relevant mutation                  |
| **Per-user-preference delivery**           | notification with per-channel modes (instant push, digest email) |
| **External LLM access**                    | `tool: ...` + MCP server at `/mcp`                               |
| **Recurring agent reports**                | job with `schedule.cron` + notification                          |

Vyn doesn't have an agent primitive because the primitives that exist already cover it. Build the agent you need from the parts.

## See also

- [Actions](/vyn/guide/actions/) — the registry and the five primitives
- [Realtime](/vyn/guide/realtime/) — subscriptions for persistent agent streams
- [Jobs](/vyn/guide/jobs/) — deferred / long-running agent work
- [Notifications](/vyn/guide/notifications/) — agent → user delivery
- [MCP](/vyn/guide/mcp/) — exposing tools to external LLMs

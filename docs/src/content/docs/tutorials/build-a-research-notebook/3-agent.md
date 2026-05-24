---
title: 3 · Agent
description: A streaming research agent. Tools the agent reads (your notes + web search), a mutation that streams its thinking via opts.tick, and a structured answer with citations.
sidebar:
    order: 3
---

We have notes. Now add an AI assistant that can search across them, fetch external pages, and answer questions — streaming its thought
process to the UI as it goes.

This page builds:

1. Two queries the agent uses as tools: `searchNotes` (your notes) and `searchWeb` (external search).
2. A `fetchPage` query that pulls a URL's text.
3. An `ask` mutation that runs the agent loop, streams events via `opts.tick`, and returns a structured answer.

The agent itself is a thin function — it loops calling the LLM, invokes tools when the model asks for them, and pipes events out.

## Search tools

```ts
// features/notes/notes.actions.ts (additions)
import { createQuery, v } from "@vynjs/core";
import type { Ctx } from "../../ctx.ts";
import { NoteSchema } from "./note.ts";
import { requireSession } from "../auth/guards.ts";

export const searchNotes = createQuery({
	description: "Search the current user's notes by title or body.",
	input: v.object({ query: v.string().min(1) }),
	output: v.array(
		NoteSchema.pick(["_id", "title", "body", "tags", "updatedAt"]),
	),
	tool: {
		description:
			"Search the user's personal notes by free text. Use this first for anything that might already be in the user's notebook.",
		examples: [{ input: { query: "tailwind dark mode" } }],
		category: "research",
	},
	run: async (opts: { input: { query: string }; ctx: Ctx }) => {
		const session = requireSession(opts);
		return opts.ctx.db.notes
			.find({ userId: session.userId, $text: { $search: opts.input.query } })
			.project({ _id: 1, title: 1, body: 1, tags: 1, updatedAt: 1 })
			.limit(10)
			.toArray() as any;
	},
});
```

```ts
// features/research/research.actions.ts
import { createQuery, v } from "@vynjs/core";
import type { Ctx } from "../../ctx.ts";
import { requireSession } from "../auth/guards.ts";

export const searchWeb = createQuery({
	description: "Search the web via Tavily / Brave / your search provider.",
	input: v.object({
		query: v.string().min(1),
		max: v.number().min(1).max(20).default(5),
	}),
	output: v.array(v.object({
		title: v.string(),
		url: v.string().url(),
		snippet: v.string(),
	})),
	tool: {
		description: "Search the public web. Use after searchNotes if the user wants up-to-date or external information.",
		category: "research",
	},
	run: async (opts) => {
		requireSession(opts);
		// Use whichever search API you prefer; this snippet uses Tavily.
		const res = await fetch("https://api.tavily.com/search", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"authorization": `Bearer ${env.TAVILY_KEY}`,
			},
			body: JSON.stringify({
				query: opts.input.query,
				max_results: opts.input.max,
			}),
		});
		const { results } = await res.json();
		return results.map((r: any) => ({
			title: r.title,
			url: r.url,
			snippet: r.content,
		}));
	},
});

export const fetchPage = createQuery({
	description: "Fetch a URL and return its main text content.",
	input: v.object({ url: v.string().url() }),
	output: v.object({
		url: v.string().url(),
		title: v.string(),
		text: v.string(),
	}),
	tool: {
		description: "Fetch a URL after searchWeb returns it. Returns extracted main text (no boilerplate).",
		category: "research",
		dangerous: false,
	},
	run: async (opts) => {
		requireSession(opts);
		const res = await fetch(opts.input.url, {
			headers: { "user-agent": "vyn-notebook/1.0" },
		});
		const html = await res.text();
		const { extract } = await import("@mozilla/readability"); // or any extractor
		const article = extract(html);
		return {
			url: opts.input.url,
			title: article.title,
			text: article.textContent,
		};
	},
});
```

Each tool action declares its `tool` field — that's what makes them visible to the agent (and to any external MCP client). The `description`
on `tool` is the LLM-facing copy, often warmer / more contextual than the action's terse top-level description.

The `requireSession` guard runs uniformly — the agent can't call tools without the user being signed in.

## The ask mutation

```ts
// features/agent/agent.actions.ts
import { createMutation, RpcError, v } from "@vynjs/core";
import { createAgent } from "@vynjs/agent";
import type { Ctx } from "../../ctx.ts";
import { requireSession } from "../auth/guards.ts";
import { searchNotes } from "../notes/notes.actions.ts";
import { fetchPage, searchWeb } from "../research/research.actions.ts";

// Typed progress events the agent streams. The client knows the shape.
const Tick = v.union([
	v.object({ kind: v.literal("status"), message: v.string() }),
	v.object({
		kind: v.literal("tool_call"),
		tool: v.string(),
		input: v.unknown(),
	}),
	v.object({
		kind: v.literal("tool_result"),
		tool: v.string(),
		output: v.unknown(),
	}),
	v.object({ kind: v.literal("text_delta"), text: v.string() }),
]);

export const ask = createMutation({
	description: "Answer a question with tool use. Streams thought and tool calls; returns a structured final answer.",
	input: v.object({
		question: v.string().min(1).max(2000),
		threadId: v.string().optional(),
	}),
	output: v.object({
		answer: v.string(),
		citations: v.array(v.string().url()),
	}),
	progress: Tick,
	tool: {
		description: "Run a research assistant that searches the user's notes and the web, then answers.",
	},
	run: async (
		opts: {
			input: { question: string; threadId?: string };
			ctx: Ctx;
			tick: (e: any) => void;
		},
	) => {
		requireSession(opts);

		const agent = createAgent({
			model: "claude-opus-4-7",
			apiKey: env.ANTHROPIC_API_KEY,
			tools: [searchNotes, searchWeb, fetchPage],
			thread: opts.input.threadId,
			system: "You are a careful research assistant. Search the user's notes FIRST, then the web. Always cite sources. Be concise.",
			onEvent: (event) => opts.tick(event),
		});

		const result = await agent.run({
			prompt: opts.input.question,
			ctx: opts.ctx,
		});

		return { answer: result.text, citations: result.citations };
	},
});
```

What this does:

1. **`createAgent` from `@vynjs/agent`** — wires the LLM SDK to the registry. Tools come from typed action references; the runner builds the
   JSON-Schema tool list from each action's `input` / `output`.
2. **`onEvent` pipes through `opts.tick`** — every LLM event flows to the client. Token deltas, tool calls, tool results, status messages.
3. **Agent runs the loop** — call the model, if it returns tool calls, invoke each tool action's `.run()` with the right `input` + `ctx`,
   feed results back, repeat until the model produces a final answer.
4. **Final return is a structured object** — the mutation's `output` schema. Citations are pulled from the agent's accumulated tool_result
   events (or returned explicitly by the model).

`createAgent` is small (~200 LOC). It's not magic — read the source of `@vynjs/agent` to see exactly how the loop is wired.

## Calling from the client

```ts
const promise = rpc.agent.ask.mutate(
	{ question: "What's my position on dark mode for the notebook?" },
	{
		onTick: (event) => {
			if (event.kind === "text_delta") output.append(event.text);
			if (event.kind === "tool_call") appendBadge(event.tool);
			if (event.kind === "status") statusEl.textContent = event.message;
		},
	},
);

const { answer, citations } = await promise;
```

The `mutate(input, { onTick })` shape is what every streaming mutation gets — same as `useMutation` from a framework binding, just plain
promises here.

## What's a citation, programmatically

The agent collects tool results during the loop. For each `fetchPage` result, the URL goes into a citation list; for each `searchNotes`
result, the note ID does. `createAgent` exposes the accumulated results via `result.citations`; the mutation surfaces them as the output's
`citations` field, which the UI renders as links beneath the answer.

If you want richer citations (page anchors, paragraph quotes), have the model emit them as JSON in its final response and parse — Claude is
good at structured output via tools.

## Cost and rate limits

The agent loop calls the LLM at least twice per question (model selects tools, then synthesizes the answer). For typical questions:

- 0–3 tool calls per question
- ~1k–3k tokens input per call
- ~500–2000 tokens output per question total

Anthropic's rate limits aren't an issue for small numbers of users. For larger scale, queue heavier requests via the
[deep research job](../4-deep-research/) instead — the next page builds it.

## Where you are

You have a streaming research assistant. The user types a question; they see the agent search their notes, hit the web, fetch a page, and
write an answer in real time. The answer comes back structured with citations. Tools are reusable — any future code can call `searchNotes`
or `fetchPage` directly without the agent in the middle.

Continue to **[4 · Deep research](../4-deep-research/)** to handle multi-minute investigations as background jobs, complete with
multi-channel notifications when the work finishes.

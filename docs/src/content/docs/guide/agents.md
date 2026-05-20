---
title: Agents
description: Build LLM loops into your app with the action registry as the toolbelt.
sidebar:
  order: 8
---

:::caution
Page coming. The shape is settled — see [Actions: the `tool` field](/guide/actions/#tool-llm-surfaces).
This page will cover the in-process agent runner, tool filtering,
streaming, and the approval flow for dangerous mutations.
:::

## Quick orientation

The in-process agent runs an LLM loop server-side with the registry as
its toolbelt. Apps spawn agents from anywhere — a route handler, a
background job, even another action — and the agent can call any tool
the registry exposes.

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

What lands here when the page is finished:

- Configuring models (Claude, OpenAI, local), API keys, retry policy
- Filtering tools (`byTool({ category })`, `tool.hidden`, explicit lists)
- Streaming text, tool calls, and tool results to the client
- The `tool.dangerous` approval flow — pause, ask, resume
- Composing agents: agents calling sub-agents via tool surface
- Audit logging every tool invocation through `meta.audit`
- Cost accounting per `agent.run`

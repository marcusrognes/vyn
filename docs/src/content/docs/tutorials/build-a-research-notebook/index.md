---
title: Build a research notebook
description: A multi-page tutorial covering MongoDB persistence, SuperJSON for rich types, a streaming AI agent, scheduled deep-research jobs, multi-channel notifications, and a polished Tailwind UI.
sidebar:
  order: 3
---

This tutorial builds a single-user research notebook with an AI
assistant. You'll wire up MongoDB for persistence, SuperJSON for
typed wire data, Tailwind for the reader UI, a streaming agent that
shows its tool calls in real time, scheduled deep-research jobs that
run overnight, and multi-channel notifications (push, email digest,
in-app) when work finishes.

By the end you'll have:

- A typed `Note` schema with tags, embeddings, citations — round-tripped
  through SuperJSON so `Date`, `Map`, and `Set` keep their types
  end-to-end.
- MongoDB-backed storage via the official driver, configured in
  `staticContext`.
- An **`ask` mutation** that calls search and fetch tools, streams
  the agent's thinking via `opts.tick`, and returns a structured
  answer with citations.
- A **`deepResearch` job** that runs the agent in a multi-pass loop
  for as long as it takes (timeout, retries, progress events
  observable via `job.watch(id)`).
- **Multi-channel notifications** that fire push and in-app instantly
  when research completes, plus a daily digest email summarizing
  the week's runs — with per-user preferences honoring all of it.
- A **Tailwind-styled UI** for browsing notes, viewing research
  results, and watching live agent runs.

The app is somewhere around 800 lines of code total. Most of it is
the agent's prompt + tools and the UI; the framework wiring is
small.

## Prerequisites

- Finish [Build notes with auth](/vyn/tutorials/build-notes-with-auth/)
  first — this tutorial assumes you understand actions, models,
  components, ctx layers, and basic auth.
- Vyn installed. See [Getting started](/vyn/getting-started/).
- MongoDB running locally (or a connection URL to a hosted instance).
  `docker run -d -p 27017:27017 mongo:7` is the fastest path.
- An API key for the LLM provider you're using. The tutorial uses
  Claude via the Anthropic SDK; swap for any provider.
- A working directory: `mkdir notebook && cd notebook && vyn init`.

## What's new compared to earlier tutorials

| Piece | New here | Why |
|---|---|---|
| MongoDB                            | yes | Rich nested documents, change streams, the de-facto choice for variable-shape data |
| SuperJSON wire transformer         | yes | `Date`, `Map`, `Set`, `BigInt` round-trip; agent results carry timestamps natively |
| Streaming mutations (`opts.tick`)  | yes | The agent's thinking shows up in the UI as it happens |
| `createJob` for deep research      | yes | Multi-minute runs that survive page reloads |
| `createNotification` (multi-channel) | yes | Instant push + deferred email digest in one declaration |
| Tailwind for the UI                | yes | Production-grade styling without authoring CSS |

## Pages

1. **[Setup](./1-setup/)** — Project scaffold, MongoDB driver, env
   schema, SuperJSON transformer, Tailwind integration.
2. **[Notes](./2-notes/)** — `Note` model with rich types, CRUD
   actions, tag-based search, realtime subscription.
3. **[Agent](./3-agent/)** — `ask` mutation: search + fetch tools,
   streaming agent loop via `opts.tick`, structured answer with
   citations.
4. **[Deep research](./4-deep-research/)** — `deepResearch` job,
   multi-channel notification (`researchReady`) for completion,
   user preferences.
5. **[UI](./5-ui/)** — Tailwind-styled reader, live agent run
   viewer, dashboard.

Each page builds on the previous one. Read in order the first time;
they cross-link freely after.

## See also

- [Actions](/vyn/guide/actions/) — the registry and the five primitives this tutorial uses
- [Jobs](/vyn/guide/jobs/) — what powers the deep-research run
- [Notifications](/vyn/guide/notifications/) — multi-channel send semantics
- [Agents](/vyn/guide/agents/) — the composition pattern this tutorial demonstrates

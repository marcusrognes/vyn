---
title: Why Vyn?
description: The design choices behind Vyn, and what it does differently.
---

Most full-stack frameworks try to be the world. Vyn tries to be small.

If you've built apps in Next or SvelteKit or Nuxt and felt that the framework was doing more than you could keep track of, Vyn is for you.
If you've started a Deno or Node project from scratch and discovered that you ended up writing the same router, the same RPC layer, and the
same WebSocket plumbing every time — also for you.

## What Vyn assumes

- You're comfortable in TypeScript.
- You want a typed end-to-end RPC layer, not REST scaffolding.
- You're happy with vanilla DOM and custom elements on the client, and signals for reactivity. No React, no Vue, no Svelte.
- You want HTTP for queries and mutations and WebSocket for subscriptions, not a SPA-only or SSR-only setup.
- You want SQLite or any other database — Vyn does not own your data layer.

## What Vyn ships

| Layer           | What it does                                                          |
| --------------- | --------------------------------------------------------------------- |
| `@vynjs/core`   | Validators, procedure + router builders, RPC errors                   |
| `@vynjs/server` | HTTP serve, RPC dispatch, WebSocket subscriptions, file-based routing |
| `@vynjs/client` | Custom elements, signals, typed RPC proxy, cache, devtools            |
| `@vynjs/auth`   | Password hashing, cookie-bound sessions, pluggable store              |
| `@vynjs/cli`    | Codegen for router barrel and route params                            |

That's it. There is no ORM, no UI library, no styling story. Bring your own.

## What Vyn doesn't do

- It does not own your build. There's a CLI for bundling client modules, and that's all.
- It does not have a plugin system. The framework is small enough to fork.
- It does not have decorators, dependency injection containers, or reflective metadata.
- It does not have a "platform". It's a library you import.

## Read the source

The whole framework is in [the monorepo](https://github.com/vyn-dev/vyn). The `packages/` directory is the entire thing. If something here
is unclear, or you want to know exactly what a function does, that's where to look.

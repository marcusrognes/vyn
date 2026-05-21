---
title: Getting started
description: Install Vyn, scaffold an app, and serve it in under a minute.
---

import { Tabs, TabItem } from '@astrojs/starlight/components';

This page walks through scaffolding a Vyn app, running it, and seeing
the result. Pick your runtime in the toggle below the first time and
the docs honor your choice from then on — every code block, every
install command.

## Prerequisites

<Tabs syncKey="runtime">
<TabItem label="Deno">

Deno 2 or newer. Check with `deno --version`. If you don't have it
installed, see [deno.com/install](https://deno.com/install).

</TabItem>
<TabItem label="Node">

Node 22 or newer (for native `node:sqlite` and `--experimental-strip-types`).
Check with `node --version`. If you need to upgrade, see
[nodejs.org](https://nodejs.org).

</TabItem>
</Tabs>

## Scaffold a new project

Vyn ships a project scaffolder. Pick a name and run the create command
for your runtime; the scaffolder drops the files, installs
dependencies, and points the dev server at the right scripts.

<Tabs syncKey="runtime">
<TabItem label="Deno">

```sh
deno create vyn@latest my-app
cd my-app
deno task dev
```

</TabItem>
<TabItem label="Node">

```sh
npm create vyn@latest my-app
cd my-app
npm run dev
```

</TabItem>
</Tabs>

The dev server is now listening on `http://localhost:8000`. Open it
and you'll see a tiny "hello, world" page.

## What just landed

The scaffold is intentionally small. Read it end to end before
changing anything; it's the seed that grows into your app.

```
my-app/
├── vyn.config.ts           framework config (actionsRoot, etc.)
├── env.ts                  typed env vars
├── server.ts               boot
├── features/
│   └── hello/
│       └── hello.actions.ts    one query that says hi
└── public/
    ├── index.html          SPA shell
    ├── style.css
    └── routes/
        ├── index.html      page at `/`
        └── index.ts        wiring for `/`
```

Notable shapes:

- The actions root is `features/` by default. Drop new
  `*.actions.ts` files anywhere underneath; Vyn picks them up.
- `env.ts` declares the env schema with `v.object({...}).parse(...)`.
  Boot fails if a required variable is missing — see
  [Configuration](/vyn/guide/configuration/).
- `server.ts` wires `staticContext` and `createContext`. The scaffold
  leaves both minimal; you fill them in as the app grows.

## Adding to an existing project

If you already have a directory and just want to drop Vyn into it,
use the `init` subcommand. It runs the same scaffolder against the
current working directory.

<Tabs syncKey="runtime">
<TabItem label="Deno">

```sh
cd existing-project
deno run -A jsr:@vyn/cli init
```

</TabItem>
<TabItem label="Node">

```sh
cd existing-project
npx @vyn/cli init
```

</TabItem>
</Tabs>

`init` will only write files that don't exist. Anything you've already
got in place (a `.gitignore`, an `env.ts`, a `package.json`) is left
alone unless you pass `--force`.

## CLI overview

Once installed, the `vyn` CLI is available via `deno task <cmd>` /
`npm run <cmd>` for the standard subcommands. The scaffold writes
these into the runtime's task file for you:

| Command | What it does |
|---|---|
| `vyn dev`           | Watch-mode server with HMR for routes, actions, and components. |
| `vyn build`         | Bundle the client, hash assets, produce a deployable artifact. |
| `vyn check`         | Type-check every file in the project. |
| `vyn gen`           | Run all codegen steps (action barrel, route params, component manifest). |
| `vyn mcp --stdio`   | Launch the app's MCP server over stdio (for local clients like Claude Desktop). |
| `vyn init`          | Scaffold Vyn files into the current directory. |
| `vyn create <name>` | Alias for `mkdir <name> && cd <name> && vyn init`. |

The CLI is the same on Deno and Node. The task file is the only
runtime-specific thing.

## Hello, world

The scaffold includes one action and one route. The action lives at
`features/hello/hello.actions.ts`:

```ts
import { createQuery, v } from "@vyn/core";

export const greet = createQuery({
	description: "Say hello to someone.",
	input:  v.object({ name: v.string().default("world") }),
	output: v.string(),
	run: async opts => `Hello, ${opts.input.name}!`,
});
```

The route at `public/routes/index.ts` calls it:

```ts
import { createApp, $ } from "@vyn/client";
import type { AppRouter } from "../../_vyn.gen.ts";

const { rpc } = createApp<AppRouter>();
const greeting = await rpc.hello.greet.query({ name: "you" });
$("#greeting").textContent = greeting;
```

That's the full round-trip: typed query, typed response, no manual
fetch, no code generation step on the client.

## Next steps

- **[Build a todo app](/vyn/tutorials/build-a-todo/)** — a complete realtime
  app in under 200 lines. Best place to go after this.
- **[Build notes with auth](/vyn/tutorials/build-notes-with-auth/)** — a
  multi-user app with SQLite, sessions, and per-user scoping.
- **[Actions](/vyn/guide/actions/)** — the registry of callable things and
  the three primitives that populate it.
- **[Configuration](/vyn/guide/configuration/)** — env validation and the
  three-layer ctx.

## Troubleshooting

**`vyn` not found.** Check that the scaffold updated your runtime's
task file. `deno task dev` and `npm run dev` should work even if
`vyn` is not on your global PATH; the scripts call the CLI directly.

**Port 8000 in use.** Set `PORT=3000` (or another port) before the
dev command, or change the default in `env.ts`.

**Type errors out of the box.** Run `vyn gen` once to populate the
`_vyn.gen.ts` barrel and route params files. The dev server runs
it automatically; the type checker doesn't.

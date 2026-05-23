---
title: Build a todo app
description: A complete walkthrough — model, actions, client, and realtime updates — in one short read.
sidebar:
  order: 1
---

This tutorial builds a small but complete todo app end-to-end. You will
write one model, four actions (a query, two mutations, a subscription),
a single client file, and watch the result work across multiple browser
tabs in realtime.

At the end you'll have:

- a typed `Todo` model with defaults and validation,
- a list/add/toggle/delete RPC surface generated from `*.actions.ts` files,
- a UI that updates instantly on changes from any tab via subscriptions,
- the same RPC paths exposed as MCP tools so an LLM can manipulate the
  list too.

The whole app is fewer than 200 lines of code.

## Prerequisites

- Deno 2+ installed. See [Getting started](/vyn/getting-started/).
- A working directory: `mkdir todo && cd todo && deno run -A jsr:@vynjs/cli init`.

We'll use a small in-memory store so the tutorial stays focused on
Vyn's shape. Swapping to SQLite (or any other store) is a one-file
change once you finish; see the [Next steps](#next-steps) section.

:::note
**Server vs browser code.** Everything is TypeScript. Files under
`features/` and `server.ts` run directly under Deno — no transpile
step. Files under `public/**/*.ts` are bundled on demand by
`@vynjs/server` when the browser requests their `.js` sibling —
`<script src="/routes/index.js">` resolves to a bundle of
`public/routes/index.ts`. Production `vyn build` writes the same
bundles to `public/dist/` with content hashes and a manifest. The
completed example lives in
[`examples/todo`](https://github.com/marcusrognes/vyn/tree/main/examples/todo).
:::

## A note on layout

This tutorial uses the **feature-folder layout**: everything that
belongs to one feature lives in one directory, including its model,
its actions, and its client-side code. Feature folders sit at the
project root alongside `server.ts` and `public/` — three top-level
things instead of an extra `app/` wrapper. Point the actions root at
`features/` in `vyn.config.ts`:

```ts
// vyn.config.ts
export default {
	actionsRoot: "features",
};
```

`features/` is the default. The `actionsRoot` setting is shown
explicitly above so the layout is obvious from reading the config; you
can omit it if you keep the default. Override it (`actionsRoot: "app"`
or any path) if your project prefers a different layout.

## What you're building

```
todo/                                     project root
├── vyn.config.ts                         points actionsRoot at features/
├── server.ts                             server boot
├── features/
│   └── todos/
│       ├── todo.ts                       Todo schema with defaults
│       └── todos.actions.ts              list, add, toggle, remove, onChanged
└── public/
    ├── index.html                        SPA shell
    ├── style.css                         a little polish
    └── routes/
        ├── index.html                    page content for `/`
        └── index.ts                      page logic for `/` (bundled on request)
```

The whole "todos" feature is one directory: model and actions.
Routes live under `public/routes/` — each `.html` is a page, the
sibling `.ts` runs on navigation to that page. Vyn handles both
kinds of discovery; you don't write a router config.

The todo row's UI lives inline in `routes/index.js` because this app
has exactly one route that renders it. When a second route would
reuse the same markup, extract it into a
`features/todos/todo-row.component.ts`. See [Components](/vyn/guide/components/).

## Step 1 — the model

Models in Vyn are validators with type inference and defaults. The
`Todo` model declares every field once and is the source of truth for
the API, the client cache, and any generated form.

```ts
// features/todos/todo.ts
import { v } from "@vynjs/core";
import { uuid } from "@vynjs/core/util";

export const TodoSchema = v.object({
	_id:       v.string().uuid().default(() => uuid()),
	title:     v.string().min(1).max(280),
	done:      v.boolean().default(false),
	createdAt: v.number().default(() => Date.now()),
	updatedAt: v.number().default(() => Date.now()),
});

export type Todo = v.Infer<typeof TodoSchema>;
```

Note that `title` is the only required input — everything else has a
default. `TodoSchema.create({ title: "Buy milk" })` will produce a fully
populated object.

If models are new to you, the [Models guide](/vyn/guide/models/) covers
defaults, constraints, derivations, and the `Note.create` factory in
detail.

## Step 2 — the actions

Vyn discovers any `*.actions.ts` file under the actions root
(`features/` in this tutorial). The directory path becomes the RPC
namespace; each named export becomes a leaf. The model lives in the
same directory, imported with a sibling path:

```ts
// features/todos/todos.actions.ts
import { createQuery, createMutation, createSubscription, v } from "@vynjs/core";
import { TodoSchema } from "./todo.ts";

export const list = createQuery({
	description: "Return every todo, newest first.",
	input:  v.object({}),
	output: v.array(TodoSchema),
	run: async opts => [...opts.ctx.todos.values()]
		.sort((a, b) => b.createdAt - a.createdAt),
});

export const onChanged = createSubscription({
	description: "Stream every todo change as it happens.",
	input:  v.object({}),
	output: v.object({
		kind: v.string(),  // "added" | "toggled" | "removed"
		todo: TodoSchema,
	}),
	// Global stream: every subscribed client sees every event.
	// For a multi-user app, do the access check inline and filter:
	//   for await (const e of opts.events)
	//     if (e.todo.userId === opts.ctx.session?.userId) yield e;
	run: async function* (opts) {
		for await (const event of opts.events) yield event;
	},
});

export const add = createMutation({
	description: "Add a todo.",
	input:  TodoSchema,
	output: TodoSchema,
	tool: {},
	run: async opts => {
		const todo = TodoSchema.create(opts.input);
		opts.ctx.todos.set(todo._id, todo);
		onChanged.emit({ kind: "added", todo });
		return todo;
	},
});

export const toggle = createMutation({
	description: "Flip the `done` flag on a todo.",
	input:  v.object({ _id: v.string().uuid() }),
	output: TodoSchema,
	tool: {},
	run: async opts => {
		const existing = opts.ctx.todos.get(opts.input._id);
		if (!existing) throw new Error("not found");
		const updated = { ...existing, done: !existing.done, updatedAt: Date.now() };
		opts.ctx.todos.set(updated._id, updated);
		onChanged.emit({ kind: "toggled", todo: updated });
		return updated;
	},
});

export const remove = createMutation({
	description: "Delete a todo.",
	input:  v.object({ _id: v.string().uuid() }),
	tool: {},
	run: async opts => {
		const existing = opts.ctx.todos.get(opts.input._id);
		if (!existing) throw new Error("not found");
		opts.ctx.todos.delete(opts.input._id);
		onChanged.emit({ kind: "removed", todo: existing });
	},
});
```

A few things worth noticing:

- **The file path determined the namespace.** Every action above is
  reachable on the client as `rpc.todos.<exportName>`. We did not write
  a router barrel.
- **`add` accepts a `Todo`** directly as input because of defaults.
  Clients only need to send `{ title: "..." }` — the model fills in
  `_id`, `done`, and timestamps.
- **The mutations call `onChanged.emit(...)`** with a typed event. No
  topic strings, no `.invalidate()`. The server only describes what
  happened; the client decides what that means for its UI.
- **`tool: {}` exposes `add`, `toggle`, and `remove` over MCP.** An
  LLM can manage the list without any extra wiring.

## Step 3 — the server boot

`serve()` takes everything from here. Provide `createContext` to attach
the in-memory store:

```ts
// server.ts
import { serve } from "@vynjs/server";
import "./_vyn.gen.ts";   // codegen barrel discovers every *.actions.ts

import type { Todo } from "./features/todos/todo.ts";

const todos = new Map<string, Todo>();

serve({
	port: 8000,
	createContext: () => ({ todos }),
	mcp: true,                   // expose tool: {} actions as MCP tools at /mcp
});
```

Run it:

```sh
vyn dev
```

The server is now listening on `http://localhost:8000`. The MCP HTTP
endpoint is mounted at `http://localhost:8000/mcp`.

## Step 4 — the SPA shell and the route

Vyn's client routing is file-based: every `.html` file under
`public/routes/` is a page, and the URL is its path under that
directory. `routes/index.html` is `/`. `routes/about.html` is `/about/`.
`routes/notes/[noteId].html` is `/notes/:noteId/`. The sibling `.ts`
file runs when the route is active.

You only need two HTML files for this tutorial: the SPA shell and the
home route.

```html
<!-- public/index.html — the SPA shell -->
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>Todos</title>
		<link rel="stylesheet" href="/style.css" />
	</head>
	<body>
		<main id="app">
			<!--ROUTES-->
		</main>
	</body>
</html>
```

The `<!--ROUTES-->` marker is where Vyn injects route placeholders.
You will not edit it directly. Vyn's discovery emits a `<a-route>`
element for every file under `routes/` and the SPA picks the matching
one based on the URL.

```html
<!-- public/routes/index.html — the page at `/` -->
<h1>Todos</h1>
<form id="add">
	<input name="title" placeholder="Add a todo…" autofocus required />
</form>
<ul id="list"></ul>
```

```css
/* public/style.css */
body  { font: 14px/1.5 system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; }
form  { margin-bottom: 1rem; }
input { width: 100%; padding: .5rem; border: 1px solid #ccc; border-radius: 4px; }
li    { display: flex; gap: .5rem; align-items: center; padding: .25rem 0; }
li.done span { text-decoration: line-through; color: #888; }
button { background: none; border: 0; cursor: pointer; padding: .25rem; }
```

## Step 5 — the route module

The route at `/` is `public/routes/index.ts`. Vyn bundles it on
the first request to `/routes/index.js` (the path the SPA shell's
`<script>` tag uses) and serves the result with no-cache headers
in dev. Edits to the file — or to any of its imports — invalidate
the cache automatically. This file
renders the list, hooks the form, subscribes to changes, and
delegates clicks for toggle/remove.

```ts
// public/routes/index.ts
import { createApp, $, html, render } from "@vynjs/client";
import type { AppRouter } from "../../_vyn.gen.ts";
import type { Todo } from "../../features/todos/todo.ts";

const { rpc, cache } = createApp<AppRouter>();

const listEl = $<HTMLUListElement>("#list");
const form   = $<HTMLFormElement>("#add");

function paint(todos: Todo[]) {
	render(listEl, todos.map(t => html`
		<li class="${t.done ? "done" : ""}" data-id="${t._id}">
			<button data-action="toggle">${t.done ? "☑" : "☐"}</button>
			<span>${t.title}</span>
			<button data-action="remove" style="margin-left:auto">×</button>
		</li>
	`));
}

// Subscribe to changes and patch the cache in place.
rpc.todos.onChanged.listen({}, {
	onValue: event => {
		cache.patch(rpc.todos.list, list => {
			switch (event.kind) {
				case "added":   return [event.todo, ...list];
				case "toggled": return list.map(t => t._id === event.todo._id ? event.todo : t);
				case "removed": return list.filter(t => t._id !== event.todo._id);
			}
		});
	},
});

// Any cache change re-paints.
cache.subscribe(rpc.todos.list, paint);

// Submit -> add.
form.addEventListener("submit", async e => {
	e.preventDefault();
	const input = form.elements.namedItem("title") as HTMLInputElement;
	if (!input.value.trim()) return;
	await rpc.todos.add.mutate({ title: input.value.trim() });
	input.value = "";
});

// Delegated click handling for the list.
listEl.addEventListener("click", async e => {
	const btn = (e.target as HTMLElement).closest("button");
	if (!btn) return;
	const id = btn.closest("li")?.dataset.id;
	if (!id) return;
	if (btn.dataset.action === "toggle") await rpc.todos.toggle.mutate({ _id: id });
	if (btn.dataset.action === "remove") await rpc.todos.remove.mutate({ _id: id });
});

// Initial load (kicks off the query, populating the cache).
void rpc.todos.list.query({});
```

That's the whole client. One file, no component layer, no custom
element registration. Each `paint()` swaps `listEl.innerHTML` for
every todo in the cache — fine for a list of a few dozen items, which
is what a todo app is.

When you grow the app — say a second route at `/archived/` that
renders the same todo row markup — that's when extracting a
`features/todos/todo-row.component.ts` pays off. Until then, inline
HTML + a delegated click handler is shorter and honest.

## Step 6 — try it

```sh
vyn dev
```

Open `http://localhost:8000` in two browser tabs side by side.

- Add a todo in one tab — it appears in the other immediately.
- Toggle a todo in one tab — the strikethrough flips in both.
- Delete a todo — it vanishes from both.

The `onChanged` subscription is doing this work; no polling, no manual
cache invalidation, no refetching round-trips.

## Step 7 — talk to it from an LLM

Because `add`, `toggle`, and `remove` declared `tool: {}`, they are
already exposed over MCP at `http://localhost:8000/mcp`. Point any MCP
client at that URL (or run `vyn mcp --stdio` and point Claude Desktop
at the binary) and the LLM gets typed access to the same actions your
UI uses.

From an MCP-aware client:

> *"Add three groceries to my todo list — milk, bread, and eggs."*

The agent calls `todos.add` three times. Each call emits an
`onChanged` event, which your two browser tabs receive, which patches
their caches, which re-paints the list. Same code path as the human UI.

## Next steps

You have a working multi-tab realtime app driven entirely by typed
actions and one subscription. From here:

- **Persistence.** Swap the in-memory `Map` for SQLite in `createContext`.
  The actions don't change. See [Database](/vyn/guide/database/) (coming).
- **Auth.** Gate actions to a logged-in user and scope the list per-user.
  See [Auth](/vyn/guide/auth/) (coming).
- **Categories or projects.** Add a `projectId` field to `Todo` and a
  `projectId` field to the subscription's input. Inside `run`, filter
  `opts.events` so a tab subscribed to one project only sees events
  for that project.
- **Forms from models.** Generate the add form from `Todo`'s schema
  instead of writing the HTML by hand. See [Models — constraints are
  data](/vyn/guide/models/#constraints-are-data).
- **Agent feature.** Use `@vynjs/agent` to run an in-process LLM that can
  use the same tools, scoped to a single user. See [Agents](/vyn/guide/agents/)
  (coming).

If anything in this tutorial felt over-built or under-built, the source
of the framework is small enough to skim — we mean that literally.

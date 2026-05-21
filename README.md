# Vyn

Small full-stack TypeScript framework. Five action primitives, no
magic, one zero-config bundler step for browser code. Runs on
Node 22+.

- **Docs**: <https://rognes.guru/vyn/>
- **Status**: pre-1.0 — the API is in place, the example apps work,
  tests are green. See [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) for
  a per-package breakdown of what's built vs. still pending.

## The five primitives

```ts
import { createQuery, createMutation, createSubscription, createJob, createNotification, v } from "@vyn/core";

export const list = createQuery({
	name:   "todos.list",
	input:  v.object({}),
	output: v.array(TodoSchema),
	run: async (opts) => [...opts.ctx.todos.values()],
});

export const add = createMutation({
	name:   "todos.add",
	input:  v.object({ title: v.string().min(1) }),
	output: TodoSchema,
	tool:   {},
	run: async (opts) => {
		const todo = TodoSchema.create(opts.input);
		opts.ctx.todos.set(todo._id, todo);
		onChanged.emit({ kind: "added", todo });
		return todo;
	},
});

export const onChanged = createSubscription({
	name:   "todos.onChanged",
	input:  v.object({}),
	output: ChangeEventSchema,
	run: async function* (opts) { for await (const e of opts.events) yield e; },
});

export const sendDigest = createJob({
	name:     "todos.sendDigest",
	schedule: { cron: "0 8 * * *" },
	run: async (opts) => { /* runs every day at 08:00 */ },
});

export const reminder = createNotification({
	name:     "todos.reminder",
	channels: {
		push:  async (opts) => ({ title: "Don't forget" }),
		email: { mode: "digest", digestKey: (i) => i.userId, defaultCron: "0 9 * * *", renderItem: ..., renderDigest: ... },
		inApp: async (opts) => ({ kind: "reminder", body: opts.input.text }),
	},
});
```

## Repo layout

```
vyn/
├── docs/                          Astro Starlight (52 pages)
├── packages/
│   ├── core/                      @vyn/core           — primitives, registry, validators, cron
│   ├── server/                    @vyn/server         — serve(), RPC dispatcher, MCP, transformers
│   ├── client/                    @vyn/client         — createApp, cache, html/render, signals
│   ├── auth/                      @vyn/auth           — scrypt + sessions
│   ├── cli/                       @vyn/cli            — vyn init / dev / build / check / gen / mcp / worker
│   ├── ui/                        @vyn/ui             — 18 behaviors + 4 widgets
│   ├── db-sqlite/                 @vyn/db-sqlite      — wraps node:sqlite
│   ├── db-mongo/                  @vyn/db-mongo       — wraps the mongodb driver
│   └── notify-inbox/              @vyn/notify-inbox   — in-app channel adapter + actions
├── examples/
│   ├── todo/                      5-primitive realtime app + MCP
│   ├── notes-auth/                Per-user data, sessions, in-memory store
│   ├── notes-sqlite/              Same as notes-auth, persisted to SQLite
│   └── research/                  Streaming agent + jobs + notifications + inbox bell + SuperJSON
└── IMPLEMENTATION.md              Per-package status
```

## Quick start

```sh
git clone https://github.com/marcusrognes/vyn.git
cd vyn
npm install
npm test                  # 237 passing
cd examples/todo && npm run dev
open http://localhost:8000
```

## Examples

| Path | Demonstrates | Try it |
|---|---|---|
| `examples/todo`         | five primitives + RPC + realtime + MCP                       | `cd examples/todo && PORT=8000 npm run dev` |
| `examples/notes-auth`   | sessions, per-user data, requireSession guard                | `PORT=8001 npm run dev` |
| `examples/notes-sqlite` | same + SQLite persistence via `@vyn/db-sqlite`               | `PORT=8002 npm run dev` |
| `examples/research`     | streaming agent (`opts.tick`), jobs, notifications, inbox    | `PORT=8003 npm run dev` |

The research example talks to Claude when `ANTHROPIC_API_KEY` is
set; otherwise it streams a deterministic mock so it runs without
configuration.

## Built-in surfaces

- **HTTP RPC** — `POST /rpc/<action.name>` with JSON `{ input: ... }`. Streams via SSE when `Accept: text/event-stream`.
- **WebSocket** — `/ws` multiplexes subscriptions. Frame shape `{ id, action, op, input }` → `{ id, kind, payload }`.
- **MCP** — `/mcp` speaks JSON-RPC 2.0. `vyn mcp --stdio` runs the same surface over stdin/stdout for Claude Desktop.
- **Static** — anything under `public/` is served as-is; route HTML files become pages via the SPA shell.
- **Browser runtime** — `/_vyn/client.js` (~11 kB) and `/_vyn/ui.js` (~13 kB) are served directly.
- **Browser source** — `public/**/*.ts` is bundled on demand in dev (esbuild, mtime cache) and pre-bundled with content hashes via `vyn build` in prod. `<script src="/foo.js">` resolves to the sibling `foo.ts`.

## Contributing

The codebase is small and easy to read. Each package is independently
testable via `npm test --workspace packages/<name>`. Suggestions and
PRs welcome.

Source: <https://github.com/marcusrognes/vyn>

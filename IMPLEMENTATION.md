# Implementation status

Snapshot of what's built. Updated 2026-05-21 (round 3, late).

## Tests: 246 passing, 18 todo (264 total)

The 18 todo entries are integration-shaped contracts that need a
multi-process / multi-browser harness (cross-process notification
delivery, MCP stdio handshake, push adapter behavior on real
devices, etc.).

## Packages

### `@vyn/core`

Every public surface implemented + tested:

- `v.*` validators — full chainable surface. JSON Schema export.
  Field-level constraint introspection. Modifiers (.optional /
  .nullable / .default with function form). Object derivations
  (.pick / .omit / .partial / .extend / .merge / .create / .empty /
  .update).
- `RpcError` + `categoryToStatus` + `isPermanent`
- `registry` with list / get / byKind / byTool / schema /
  onRegister / clear
- `createQuery` / `createMutation` / `createSubscription` /
  `createJob` / `createNotification` — all five primitives with
  full opts.tick + progress validation
- Subscription event queue (eager registration; signals abort)
- Job: in-memory store + .now / .at / .in / .cancel / .status /
  .watch / .result + retries + backoff (exponential / linear /
  custom) + RpcError category retry rules + timeout
- Cron parser + previousTick / nextTick (tz-aware via
  Intl.DateTimeFormat; POSIX dom/dow OR semantics)
- Notification runtime: installNotify({ adapters, preferences,
  coalesceWindowMs }) singleton; per-channel queues; cron-driven
  digest flush per user preference; coalesce-window bundling;
  preferences resolver overrides mode / digest
- Background ctx (installBackgroundCtx + getBackgroundCtx) so jobs
  and worker-dispatched notifications see the same static state
- Cron job auto-scheduler (startCronJobs at boot)
- `@vyn/core/util` — uuid, sleep, deepClone, groupBy,
  stableStringify

### `@vyn/server`

- `serve()` — Node http server, staticContext + createContext,
  3-layer ctx merge with BaseCtx precedence, EventBus, ws upgrade,
  per-request response side channel
- handleRpc — JSON or SSE (when `Accept: text/event-stream`); RpcError → HTTP status
- attachWebSocket — multiplexed subscriptions
- handleMcp — JSON-RPC 2.0: initialize / tools/list / tools/call /
  resources/list / resources/read / prompts/list / prompts/get
- static.ts — extension-based content-type + SPA fallback
- transformer contract (SuperJSON-shaped)
- Boot log: `listening on … — N actions registered (k query, m
  mutation, …)`
- `noListen: true` for CLI subcommands

### `@vyn/client`

- `createApp<R>({ transformer })` → `{ rpc, cache }`
- Proxy-based `rpc.<path>.query / .mutate / .listen / .iterate`
- SSE consumer (`mutate(input, { onTick })`)
- WebSocket subscription manager (singleton, multiplexed)
- Cache with patch / set / get / invalidate / subscribe keyed by
  `(action, stable-stringify input)`
- `html\`\`` + `render()` — tagged template literal
- `signal()`, `component()`, `$ / $$ / on()`
- Browser bundle at `packages/client/browser.js` (~11 kB)

### `@vyn/auth`

- scrypt password hashing + timing-safe verify
- randomToken
- createMemorySessionStore

### `@vyn/cli`

- `vyn init` — scaffolds package.json + tsconfig + server.ts + SPA shell
- `vyn dev` — boots app + watches features/ + public/routes/ and
  re-runs gen on changes
- `vyn build` — placeholder
- `vyn check` — `tsc --noEmit`
- `vyn gen` — emits _vyn.gen.ts with action imports + route array
- `vyn mcp --stdio` — JSON-RPC over stdin/stdout
- `vyn worker` — boot-and-run forever for jobs

### `@vyn/ui`

All 18 documented behaviors:

| Behavior | Status |
|---|---|
| keyboard-nav     | implemented + happy-dom test |
| typeahead        | implemented |
| select           | implemented + test |
| dismiss          | implemented + test |
| focus-trap       | implemented |
| anchor           | implemented + test |
| popover          | implemented |
| tooltip          | implemented |
| scroll-into-view | implemented |
| sort             | implemented + test |
| sortable         | implemented |
| drag-drop        | implemented |
| edit             | implemented + test |
| auto-resize      | implemented + test |
| aria-describedby | implemented |
| form-associated  | implemented |
| copy             | implemented + test |
| live             | implemented |

All 4 widgets:

| Widget         | Status |
|---|---|
| `<v-toaster>`  | implemented + test |
| `<v-combobox>` | implemented |
| `<v-table>`    | implemented |
| `<v-grid>`     | implemented |

Browser bundle at `packages/ui/browser.js` (~13 kB).

### `@vyn/db-sqlite`

- `openSqlite(path).collection<T>(table)` — insert / get / find /
  update / delete / count over a JSON-row table

### `@vyn/db-mongo`

- `openMongo(url, db).collection<T>(name)` — thin wrapper over the
  official driver

### `@vyn/notify-inbox`

- inboxAdapter that persists each delivery as InboxRow + optional
  subscription emit
- Prebuilt actions: inbox.list, inbox.count, inbox.markRead,
  inbox.markAllRead, inbox.onNew

## Example apps

| App | Demonstrates | Verified end-to-end |
|---|---|---|
| `todo`         | 5 primitives + MCP + WebSocket realtime          | yes |
| `notes-auth`   | sessions + per-user scoping (in-memory)          | yes |
| `notes-sqlite` | same + SQLite persistence + restart survives     | yes |
| `research`     | streaming agent + jobs + multi-channel notify + inbox bell + SuperJSON + Tailwind | yes |

## Built-in HTTP surfaces

- `POST /rpc/<action.name>` — JSON or SSE
- `GET /ws` (upgrade) — multiplexed subscriptions
- `POST /mcp` — JSON-RPC 2.0 (tools + resources + prompts)
- `GET /_vyn/client.js` — browser runtime bundle
- `GET /_vyn/ui.js` — UI behaviors + widgets browser bundle
- Anything else under `public/` — static + SPA fallback

## What still needs work

1. **Drop `@vyn/db-sqlite` and `@vyn/db-mongo` as packages.** Vyn's
   stance: bring your own database. Apps import the driver
   directly (`node:sqlite`, `mongodb`, `pg`, whatever) and wire it
   into `staticContext`. The two adapter packages are an
   unnecessary indirection — remove them and update the tutorials
   to show direct driver usage.
2. **Rewire `examples/research` to use real MongoDB** via the
   `mongodb` driver directly. Drop the in-memory Map fallback.
   Add a docker-compose.yml so the example boots its own Mongo
   for development.
3. **Rewire `examples/notes-sqlite` similarly** — drop the
   `@vyn/db-sqlite` dependency, use `node:sqlite` directly. Keep
   the example small enough to read in one sitting.
4. Real LLM in `examples/research` — wired but commented as
   ANTHROPIC_API_KEY-gated; needs more polish + tool-use loop
5. Tutorial doc reconciliation across the build-a-research-notebook
   pages (some still reference the all-or-nothing tutorial flow
   while the example builds incrementally)
6. UI behavior interaction tests via Playwright (currently
   happy-dom unit only; full keyboard / focus / ARIA needs a real
   browser)
7. Form validation: native validity API + Vyn-side helpers
8. `vyn build` actually building (vs. shipping sources directly)

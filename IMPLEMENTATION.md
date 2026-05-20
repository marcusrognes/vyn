# Implementation status

Snapshot of what's actually built vs. what's still documented but not
implemented. Updated 2026-05-21 (round 2).

## Working end-to-end

### `@vyn/core`

| Surface | State |
|---|---|
| `v.*` validators                                  | ✅ object, string, number, boolean, date, array, union, record, literal, instanceOf, map, any. .parse/.create/.empty/.update. .optional/.nullable/.default (function form). .pick/.omit/.partial/.extend/.merge. Per-type constraints (.min/.max/.regex/.email/.url/.uuid/.trim/.lowercase/.integer/.positive/.negative/.multipleOf/.finite/.length/.unique). JSON Schema exposed via `.schema` |
| `RpcError`                                        | ✅ category set + categoryToStatus mapping + isPermanent retry rule |
| `registry`                                        | ✅ list / get / byKind / byTool / schema / onRegister / clear |
| `createQuery`                                     | ✅ run / input validation / output validation (dev only) / `opts.tick` with `progress` schema validation / `tool` exposure |
| `createMutation`                                  | ✅ same as Query, rejects `invalidates` field |
| `createSubscription`                              | ✅ async-generator run / `opts.events` AsyncIterable / `.emit` / signal abort propagation / eager queue registration so emits between run() and first iter.next() aren't lost |
| `createJob`                                       | ✅ in-memory store / .now/.at/.in/.cancel/.status/.watch/.result / retries + backoff (exponential/linear/custom) / timeout / RpcError-category retry rules (permanent vs transient) |
| `createNotification`                              | ✅ instant + deferred + digest modes. Routes through the notification runtime (notify-runtime.ts). |
| `inboxAdapter`                                    | ✅ moved to `@vyn/notify-inbox`; persists rows; optional subscription emit |
| `inbox.list / count / markRead / markAllRead / onNew` | ✅ prebuilt actions in `@vyn/notify-inbox/actions`; apps import the module to register them |
| `cron`                                            | ✅ parser + previousTick + nextTick, timezone-aware via Intl.DateTimeFormat, POSIX dom/dow OR semantics |
| notification runtime                              | ✅ installNotify({ adapters, preferences, coalesceWindowMs }) + flush loop. Per-channel queues, per-user cron-driven digest flush, coalesce window for cross-notification bundling, preferences resolver overrides mode/digest |

### `@vyn/server`

| Surface | State |
|---|---|
| `serve()`                                          | ✅ Node http server, staticContext (boot once) + createContext (per-request), 3-layer ctx merge with BaseCtx precedence, EventBus, ws upgrade for subscriptions |
| `handleRpc`                                        | ✅ POST /rpc/`name` → JSON or SSE (when `accept: text/event-stream`); RpcError → HTTP status mapping |
| `attachWebSocket`                                  | ✅ multiplexed subscriptions; client frames `{ id, action, op, input }`; server emits `{ id, kind, payload }` |
| static                                             | ✅ extension-based content-type detection + SPA fallback |
| cookies / response side channel                    | ✅ `ctx.setStatus / setHeader / setCookie` writes to per-request mutable side channel |
| transformer                                        | ✅ wire shape: client sends `{ input: <serialized> }`, server plucks `.input` and runs `transformer.deserialize` on it |

### `@vyn/client`

| Surface | State |
|---|---|
| `createApp<R>({ transformer })`                    | ✅ returns `{ rpc, cache }` |
| `rpc.<path>.query / .mutate`                       | ✅ Proxy walks path → POST /rpc/`a.b.c` |
| `mutate(input, { onTick })`                        | ✅ flips to SSE consumer; emits each `event: tick` to `onTick`, returns final `event: result` |
| `rpc.<path>.listen / .iterate`                     | ✅ multiplexed WebSocket via singleton manager |
| `Cache`                                            | ✅ get/set/patch/invalidate/subscribe keyed by `(action, JSON-stable input)` |
| `html\`\``+ `render(el, html)`                       | ✅ tagged template, escape-by-default, nested html passes through unescaped, arrays interpolate as joined output |
| `signal()`                                         | ✅ get() / set() / update() / subscribe() |
| `component(name, setup)`                           | ✅ wraps customElements.define; props proxied from dataset + element properties |
| `$ / $$ / on()`                                    | ✅ DOM helpers |
| browser bundle                                     | ✅ `packages/client/browser.js` is a single self-contained ESM file served by `serve()` at `/_vyn/client.js` so app code imports without a bundler |

### `@vyn/auth`

| Surface | State |
|---|---|
| `hashPassword` / `verifyPassword`                  | ✅ scrypt + timing-safe compare |
| `randomToken`                                      | ✅ |
| `createMemorySessionStore`                         | ✅ in-memory implementation of the SessionStore interface |

### `@vyn/cli`

| Subcommand | State |
|---|---|
| `vyn init`                                         | ✅ scaffolds package.json + tsconfig + server.ts + SPA shell |
| `vyn dev`                                          | ✅ runs `node --experimental-strip-types --watch server.ts` |
| `vyn build`                                        | 🟡 placeholder — strip-types runs sources directly |
| `vyn check`                                        | ✅ runs `tsc --noEmit` |
| `vyn gen`                                          | ✅ scans features/*.actions.ts + public/routes/*.html → `_vyn.gen.ts` |
| `vyn mcp --stdio`                                  | ✅ boots app, exposes initialize/tools/list/tools/call over stdin/stdout |
| `vyn worker`                                       | ✅ boots app + runs forever; notification flush loop is in-process by default but can stand alone via this subcommand |

### `@vyn/ui`

| Behavior | State |
|---|---|
| `keyboard-nav`                                     | ✅ roving-tabindex + arrows/Home/End + activate event |
| `typeahead`                                        | ✅ letter buffer with idle reset; cycles same-letter |
| `select` (single / multi)                          | ✅ data-value + aria-selected + change event |
| `dismiss`                                          | ✅ esc / outside / focus-out triggers with cancelable event |
| `focus-trap`                                       | ✅ tab cycling, focus restoration, MutationObserver for visibility |
| `anchor`                                           | ✅ JS fallback positioning with viewport clamping |
| `popover`                                          | ✅ wraps native `popover` attribute, falls back to JS dismiss + outside-click |
| `tooltip`                                          | ✅ hover-delayed, focus-immediate, esc-dismiss |
| `scroll-into-view`                                 | ✅ container-level focus / selected / custom-attr trigger |
| `sort`                                             | ✅ thead-container behavior cycles asc→desc→unsorted, multi mode |
| `auto-resize`                                      | ✅ textarea grows with content, respects min/max rows |
| `aria-describedby`                                 | ✅ pairs + optional invalid-only mode |
| `copy`                                             | ✅ data-copy='selector' → clipboard + data-state='copied' flash |
| `live(message)`                                    | ✅ singleton aria-live regions, throttled |
| `<v-toaster>`                                      | ✅ custom element + global `vynToast({ body, kind, timeout })` helper |
| `form-associated`                                  | ✅ mirrors data-value to a hidden `<input name=...>` so wrapping `<form>` submits it |
| `sortable`                                         | ✅ pointer + keyboard (space-to-pickup, arrows to move, esc to cancel); fires `reorder` |
| `drag-drop`                                        | ✅ typed via data-draggable + data-dropzone + data-accepts; fires `drop` / `rejected` |
| `edit`                                             | ✅ Enter / F2 / dblclick activate; Esc cancels; Enter/Tab commits with `change` event |
| `<v-grid columns=N>`                               | ✅ focusable cell grid with arrow / Home / End navigation; fires `cellfocus` |
| `<v-table columns rows>`                           | ✅ JSON-driven sortable table rendered as native `<table>`; fires `sort` |
| `<v-combobox>`                                     | ✅ text input + listbox; suggestions via attribute, setter, or `fetch` event |

## Tests

- 202 tests pass
- 18 tests are `it.todo` for infrastructure that lives in adapter
  layers (digest worker, bundling coalesce window, MCP exposure,
  preferences resolver — see test files for the spec)

## Example apps under `examples/`

Each is a runnable demonstration of one part of the framework,
built by following the matching tutorial. See
[`examples/README.md`](./examples/README.md).

| App | What it demonstrates | Built? |
|---|---|---|
| `todo`         | five-primitive realtime app + MCP                          | ✅ end-to-end |
| `notes-auth`   | per-user data scoping, sessions, requireSession guard      | ✅ end-to-end (in-memory store) |
| `notes-sqlite` | same as notes-auth but persisted via `@vyn/db-sqlite`      | ✅ end-to-end — notes survive server restart |
| `research`     | streaming agent via `opts.tick`, SuperJSON, jobs, mock LLM | ✅ end-to-end (mock LLM; no real Anthropic call) |

## Known divergences from the docs

1. **Client routes are `.js`, not `.ts`.** Browsers don't execute
   TypeScript directly. The tutorial mentions `.ts` because a future
   build step is planned; today's examples ship plain ES modules.
2. **`uuid` helper not under `@vyn/core/util`.** Examples use
   `crypto.randomUUID()` from the global standard library.
3. **MongoDB persistence in the research tutorial uses an in-memory
   `Map` in the example** — the tutorial's `db.ts` design carries
   through once MongoDB is wired.
4. **Tailwind in the research-notebook tutorial** isn't reproduced in
   the example — plain CSS instead.

## Tests

- 220 passing (was 218)
- 18 todo (worker / bundling integration tests that need an end-
  to-end harness; sqlite vitest resolver issue tracked separately)

## What's left

1. UI browser bundle (`/_vyn/ui.js`) so behaviors + widgets load
   in app pages without a build step (today they need esbuild or
   manual concatenation).
2. Real LLM integration in `examples/research` (drop the mock).
3. MongoDB integration test using a docker-compose harness.
4. Resource + prompt support in the MCP surface (currently only
   tools are exposed).
5. Per-tutorial doc reconciliation: the docs reference SQLite,
   Tailwind, an `inbox` ctx key, etc. — wire each into a worked
   example or trim the doc to the actual surface.

# Implementation status

Snapshot of what's actually built vs. what's still documented but not
implemented. Updated 2026-05-21.

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
| `createNotification`                              | 🟡 .send fan-out + .preview + .run + .now/.at/.in works for **instant** mode. Deferred/digest queue exists but uses `setTimeout` not a worker; no cross-notification bundling, no coalescing window, no per-user cron flushWhen |
| `inboxAdapter`                                    | 🟡 stub that writes to a `collection.insertOne` if provided; no built-in list/count/markRead/markAllRead actions yet |

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
| `vyn mcp --stdio`                                  | ❌ not implemented |
| `vyn worker`                                       | ❌ not implemented (jobs run in-process) |

### `@vyn/ui`

| Behavior | State |
|---|---|
| `keyboard-nav`                                     | ✅ roving-tabindex + arrows/Home/End + activate event |
| `select` (single / multi)                          | ✅ data-value + aria-selected + change event |
| `dismiss`                                          | ✅ esc / outside / focus-out triggers with cancelable event |
| `anchor`                                           | ✅ JS fallback positioning with viewport clamping |
| `live(message)`                                    | ✅ singleton aria-live regions, throttled |
| `copy`                                             | ✅ data-copy='selector' → clipboard + data-state='copied' flash |
| 13 other behaviors documented                      | 🟡 documented; not yet implemented |
| 4 widgets (`<v-grid>`, `<v-table>`, `<v-combobox>`, `<v-toaster>`) | 🟡 documented; not yet implemented |

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
| `todo`        | five-primitive realtime app                                | ✅ end-to-end |
| `notes-auth`  | per-user data scoping, sessions, requireSession guard      | ✅ end-to-end (in-memory store, not SQLite as the tutorial suggests) |
| `research`    | streaming agent via `opts.tick`, SuperJSON, jobs, mock LLM | ✅ end-to-end (mock LLM; no real Anthropic call) |

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

## Next session priorities

1. Notification worker subsystem: per-channel queue with cron-driven
   flushes that honor per-user preferences + the coalescing window
   for cross-notification bundling.
2. MCP server surface (`vyn mcp --stdio` + HTTP at `/mcp`).
3. `vyn worker` standalone process for jobs.
4. Remaining 13 UI behaviors + 4 widgets.
5. SQLite + MongoDB adapters as `@vyn/db-sqlite` / `@vyn/db-mongo`.
6. Live `<LiveExample>` MDX component in the docs so behavior pages
   demonstrate themselves.

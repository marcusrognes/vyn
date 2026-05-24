# Vyn examples

Each app under `examples/` is a runnable demonstration of a piece of the framework. They were built by following the tutorial docs and
fixing the framework where the tutorial uncovered a gap.

## Apps

| App                            | Demonstrates                                                                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[todo](./todo)**             | Five-primitive realtime app. `createQuery`/`createMutation`/`createSubscription`, in-memory store, WebSocket events, MCP tool exposure. ~120 lines total.                                                                     |
| **[notes-auth](./notes-auth)** | Per-user data scoping. `@vynjs/auth` scrypt password hashing + memory session store, `requireSession` guard, `setCookie` via ctx, subscription filters by `ctx.userId`.                                                       |
| **[research](./research)**     | Streaming agent + jobs + notifications + SuperJSON. `opts.tick` fires through Server-Sent Events, typed against the action's `progress` schema; `createJob` runs deferred research; `createNotification` fires on completion. |

## Run an example

```sh
cd examples/todo
PORT=8000 npm run dev
open http://localhost:8000
```

The dev script runs the server directly under Node 22+'s `--experimental-strip-types` flag so source `.ts` files execute without a separate
compile step. Browser-side code is plain `.js` that imports the framework's runtime from `/_vyn/client.js`.

## What's not (yet) in these examples

- MongoDB / SQLite persistence (the tutorials use them; the examples use `Map<>` for tonight's iteration)
- Tailwind via a build step (the research-notebook tutorial uses Tailwind; the example ships plain CSS)
- A real LLM connection in `examples/research` (the `agent.ask` mutation is mocked — wire `@anthropic-ai/sdk` and an `ANTHROPIC_API_KEY` to
  make it real)
- Per-user digest scheduling (cron parser + worker loop are TODO)
- Cross-notification bundling (coalescing window + bundle render are TODO)

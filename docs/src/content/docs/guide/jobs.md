---
title: Jobs
description: Scheduled, deferred, and recurring work as a fourth action primitive. Pluggable job store; cron, retries, and at-time scheduling baked in.
sidebar:
    order: 8
---

A **job** is an action that runs later. Sometimes "later" means a few seconds from now (after a request completes), sometimes a specific
time (in 30 minutes), sometimes on a cron (every day at 9am). All of these are the same primitive in Vyn — `createJob` — with a small typed
API for picking the schedule.

Jobs live in the same registry as queries, mutations, and subscriptions. They participate in MCP exposure (where `tool` makes sense), CLI
invocation (`vyn run notes.cleanup`), and direct `.run()` for tests. What makes them different: they don't return to a caller, they retry on
failure, and they're pulled from a **pluggable job store** by a worker process.

## A complete example

```ts
// features/notes/cleanup.actions.ts
import { createJob, v } from "@vynjs/core";
import { requireSession } from "../auth/guards.ts";

export const cleanup = createJob({
	description: "Hard-delete notes that have been in trash for 30 days.",
	input: v.object({}),
	schedule: { cron: "0 4 * * *" }, // every day at 04:00
	retries: 3,
	run: async (opts) => {
		const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
		opts.ctx.db
			.prepare("DELETE FROM notes WHERE deletedAt < ?")
			.run(cutoff);
	},
});
```

That's the whole job. From here:

- A worker (`vyn worker` or `worker: true` in `serve()`) pulls `cleanup` from the job store every day at 4am and runs it.
- If `run` throws, the job store schedules a retry with backoff. After 3 failed attempts, it's marked failed and surfaced in the dead-letter
  view.
- `cleanup.now({})` from any mutation enqueues it for immediate execution.
- `cleanup.at(new Date("2026-12-25T09:00Z"), {})` schedules it for a specific time.

## The primitive

```ts
createJob({
	description: "...",         // recommended; required if tool is set
	input:    v.object({...}),  // optional; defaults to v.object({})
	schedule: { cron: "...", interval: "..." },   // optional; for recurring jobs
	retries:  3,                // optional; default 0 (no retries)
	backoff:  "exponential",    // "exponential" | "linear" | { fn }
	timeout:  60_000,           // ms; default 30_000
	tool:     { ... },          // optional; LLM surfaces
	run:      async (opts) => ...,
});
```

`opts` carries:

- `opts.input` — validated, typed input
- `opts.ctx` — same ctx every other action gets (BaseCtx + static + dynamic)
- `opts.job` — `{ id, attempt, scheduledAt }` — for retry-aware logic

## Methods on the typed reference

| Method                | What it does                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `job.run(opts)`       | Invoke directly. For tests, scripts, manual triggers                                                                                                                      |
| `job.now(input)`      | Enqueue for immediate execution. Returns the job id                                                                                                                       |
| `job.at(date, input)` | Enqueue for a specific time. Returns the job id                                                                                                                           |
| `job.in(ms, input)`   | Sugar for `at(new Date(Date.now() + ms), input)`                                                                                                                          |
| `job.cancel(jobId)`   | Remove a queued job                                                                                                                                                       |
| `job.status(jobId)`   | `{ state: "queued" \| "running" \| "completed" \| "failed", attempts, lastError?, lastTick? }`                                                                            |
| `job.watch(jobId)`    | Async iterable of progress ticks + the final result. `for await` yields `{ kind: "tick", payload }` and finally `{ kind: "result", value }` or `{ kind: "error", error }` |
| `job.result(jobId)`   | Promise that resolves with the final return value (or rejects on failure). Sugar for waiting without consuming ticks                                                      |

Schedule on the action record (`cron`, `interval`) registers automatically at boot. App code calls `.now()` / `.at()` for ad-hoc scheduling.

```ts
// from a mutation
import { sendWelcomeEmail } from "../notifications/notifications.actions.ts";

export const signup = createMutation({
	input: Credentials,
	output: UserPublicSchema,
	run: async (opts) => {
		const user = await createUser(opts);
		sendWelcomeEmail.in(5 * 60 * 1000, { userId: user._id }); // 5 min delay
		return user;
	},
});
```

## Job store

The **job store** is where queued jobs live. Configure it once on `serve()`; everything else stays the same.

```ts
import { serve } from "@vynjs/server";
import { redisJobStore } from "@vynjs/jobs-redis";

serve({
	port: env.PORT,
	jobs: {
		store: redisJobStore({ url: env.REDIS_URL }),
		worker: true, // run a worker in this process; or set false and run `vyn worker` separately
	},
});
```

### Built-in stores

| Package                 | Backend                     | Notes                                                  |
| ----------------------- | --------------------------- | ------------------------------------------------------ |
| `@vynjs/core` (default) | In-memory                   | Fast; lost on restart; fine for dev and tests          |
| `@vynjs/jobs-redis`     | Redis sorted sets + BRPOP   | Low-latency, no durability past Redis config           |
| `@vynjs/jobs-postgres`  | Postgres with `SKIP LOCKED` | Durable; reuses your existing DB                       |
| `@vynjs/jobs-mongo`     | MongoDB                     | Agenda.js-shaped semantics; durable; cron + scheduling |

All four implement the same interface:

```ts
export interface JobStore {
	enqueue(name: string, input: unknown, opts: {
		runAt: Date;
		attempt?: number;
		priority?: number;
	}): Promise<string>;
	next(workerId: string): Promise<Job | null>;
	complete(jobId: string): Promise<void>;
	fail(jobId: string, error: Error, retryAt?: Date): Promise<void>;
	cancel(jobId: string): Promise<void>;
	status(jobId: string): Promise<JobStatus>;
	close?(): Promise<void>;
}
```

Implementing a custom store is straightforward — see [`@vynjs/jobs-redis`](https://github.com/vyn-dev/vyn/tree/main/packages/jobs-redis) for
a reference implementation.

## Workers

A **worker** is the process that pulls jobs and runs them. Two options:

1. **In-process worker** — `worker: true` in `serve()`. The HTTP server and the worker live in one process. Simplest; fine for small apps.
2. **Standalone worker** — `vyn worker` as a separate process. Same codebase, no HTTP. Scale horizontally for job-heavy apps.

Both run the same action code with the same ctx. The standalone worker still goes through `staticContext` + `createContext` on boot (or
per-job, configurable).

### Concurrency

`vyn worker --concurrency=4` pulls up to 4 jobs in parallel from the store. The default is 1. For CPU-heavy work, scale process count
instead of concurrency.

### Graceful shutdown

On SIGTERM, the worker stops pulling new jobs, waits for in-flight ones to complete (or hit timeout), calls `store.close()`, and exits. Apps
in Kubernetes / Docker shut down cleanly.

## Progress and status

Long jobs can emit progress via `opts.tick()` — same API queries and mutations use. Declare a `progress` schema on the job to type the
events; omit it for free-form `{ message, progress?, data? }`.

```ts
createJob({
	description: "Generate the monthly report.",
	input: v.object({ month: v.string() }),
	progress: v.object({ stage: v.string(), pct: v.number() }),
	run: async (opts) => {
		opts.tick({ stage: "loading", pct: 0.1 });
		const data = await loadMonth(opts.input.month);

		opts.tick({ stage: "aggregating", pct: 0.5 });
		const report = await aggregate(data);

		opts.tick({ stage: "rendering", pct: 0.9 });
		await render(report);
	},
});
```

Observers tail the job:

```ts
const id = generateReport.now({ month: "2026-05" });

for await (const event of generateReport.watch(id)) {
	if (event.kind === "tick") updateProgressBar(event.payload);
	if (event.kind === "result") notify("Done");
	if (event.kind === "error") alert(event.error.message);
}
```

`job.status(jobId)` includes the last tick payload so dashboards can read state without subscribing. The job store keeps ticks for a short
window (configurable; default 5 minutes after completion) so late `watch()` calls can replay the recent history.

## Retries and backoff

Set `retries: N` on `createJob` to retry on failure. The store re-enqueues with a delay computed by `backoff`:

| `backoff` value           | Delay function                        |
| ------------------------- | ------------------------------------- |
| `"exponential"` (default) | `2^attempt * 1s`, capped at 5 minutes |
| `"linear"`                | `attempt * 30s`                       |
| `{ fn: (attempt) => ms }` | Custom                                |

After `retries` is exhausted, the job is marked `failed`. Failed jobs stay in the store (with their last error) for inspection; implement a
periodic cleanup with another `createJob` if you want them gone.

`RpcError` thrown from `run` is treated as a permanent failure if the category is one of `unauthorized` / `forbidden` / `not_found` /
`bad_request` — retries don't help for those. `internal` and `conflict` (and anything else thrown) trigger retries.

## Recurring schedule

```ts
createJob({
	schedule: { cron: "0 9 * * *" }, // standard cron
	// or
	schedule: { interval: "5 minutes" }, // simple interval (human-readable)
	// or
	schedule: { interval: 60_000 }, // ms
	// or
	schedule: { cron: "0 9 * * *", timezone: "Europe/Oslo" },
	// ...
});
```

The framework registers the schedule with the store at boot. On deployment of a new version with a removed or changed schedule, the
framework reconciles — orphan schedules are cancelled.

Schedules survive restarts because they live in the store, not the process.

## CLI

```sh
vyn jobs list                  # show queued + running + failed
vyn jobs run <name> [--input='{...}']   # ad-hoc trigger
vyn jobs status <jobId>
vyn jobs cancel <jobId>
vyn jobs retry <jobId>         # re-enqueue a failed job
vyn worker [--concurrency=N]
```

## Observability

Jobs surface telemetry via the same `meta.audit` hook other actions use. The framework emits:

- `job.enqueued` `{ name, id, runAt, attempt }`
- `job.started` `{ name, id, attempt }`
- `job.completed` `{ name, id, attempt, durationMs }`
- `job.failed` `{ name, id, attempt, error }`
- `job.retried` `{ name, id, attempt, nextRunAt }`

Listen on `ctx.bus` (the in-process bus) or pipe to your logger / APM via the [transport](/vyn/guide/transport/) wrapper pattern.

## When NOT to use a job

For work that can complete inside the request:

- Validating input — do it inline; jobs are for _after_ the response.
- Reading from a cache — synchronous.
- Things the user is waiting for — show a spinner, finish the work in the handler.

Jobs are for _fire-and-forget from the user's perspective_: send this email, expire this token, summarize this thread overnight.

## See also

- [Actions](/vyn/guide/actions/) — the registry that holds jobs alongside other primitives
- [Notifications](/vyn/guide/notifications/) — built on top of jobs; per-channel send semantics
- [Configuration](/vyn/guide/configuration/) — `serve({ jobs })` shape
- [Transport](/vyn/guide/transport/) — similar pluggable-adapter pattern

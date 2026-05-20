import { describe, expect, it, vi } from "vitest";

// Contracts from /guide/jobs/
describe.todo("createJob — returns an action record with kind 'job'");
describe.todo("createJob — registers in the global registry");
describe.todo("createJob — input defaults to v.object({}) when omitted");

describe.todo("job.run(opts) — direct call invokes run() with opts.input and opts.ctx");
describe.todo("job.now(input) — enqueues immediately, returns job id");
describe.todo("job.at(date, input) — enqueues for specific time, returns job id");
describe.todo("job.in(ms, input) — sugar for at(Date.now() + ms)");
describe.todo("job.cancel(jobId) — removes a queued job");
describe.todo("job.status(jobId) — returns { state, attempts, lastError? }");

describe.todo("job opts.job — { id, attempt, scheduledAt } available in run");

describe.todo("schedule.cron — registers a recurring schedule at boot");
describe.todo("schedule.interval — accepts ms or human-readable strings");
describe.todo("schedule.timezone — cron honors timezone");

describe.todo("retries — default 0; runs N+1 times before failing permanently");
describe.todo("backoff exponential — 2^attempt seconds, capped at 5 minutes");
describe.todo("backoff linear — attempt * 30s");
describe.todo("backoff custom function — { fn: (attempt) => ms }");
describe.todo("RpcError unauthorized/forbidden/not_found/bad_request — permanent, no retry");
describe.todo("RpcError internal/conflict + generic Error — triggers retry");

describe.todo("timeout — terminates run after configured ms; counts as failure");

describe.todo("Worker — pulls from job store via store.next(workerId)");
describe.todo("Worker — graceful shutdown waits for in-flight jobs");
describe.todo("Worker --concurrency=N — pulls up to N jobs in parallel");

describe.todo("JobStore interface — enqueue, next, complete, fail, cancel, status, close?");
describe.todo("In-memory store — default; survives nothing");

describe.todo("Bus events — job.enqueued, job.started, job.completed, job.failed, job.retried");

describe.todo("opts.tick(payload) — emits progress; validated against progress schema if declared");
describe.todo("job.watch(jobId) — async iterable yields { kind: 'tick' | 'result' | 'error' }");
describe.todo("job.result(jobId) — promise of final value (or rejection)");
describe.todo("job.status(jobId).lastTick — most recent tick payload");
describe.todo("Tick history — kept for a configurable window after completion (default 5 min)");

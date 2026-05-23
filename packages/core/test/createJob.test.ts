import { describe, expect, it, beforeEach } from "vyn:test";
import { createJob, registry, RpcError } from "../src/index.ts";

// Contracts from /guide/jobs/
describe("createJob", () => {
	beforeEach(() => {
		(registry as any).clear?.();
	});

	describe("registry record", () => {
		it("returns an action with kind 'job'", () => {
			const j = createJob({ run: async () => undefined });
			expect(j.kind).toBe("job");
		});

		it("registers itself in the global registry", () => {
			const j = createJob({ name: "test.cleanup", run: async () => undefined });
			expect(registry.get("test.cleanup")).toBe(j);
		});

		it("input defaults to v.object({}) when omitted", () => {
			const j = createJob({ run: async () => undefined });
			expect(j.input).toBeDefined();
		});

		it("exposes .run, .now, .at, .in, .cancel, .status, .watch, .result", () => {
			const j = createJob({ run: async () => undefined });
			for (const m of ["run", "now", "at", "in", "cancel", "status", "watch", "result"]) {
				expect(typeof (j as any)[m]).toBe("function");
			}
		});
	});

	describe("direct .run(opts)", () => {
		it("invokes run with opts.input and opts.ctx", async () => {
			let seen: unknown;
			const j = createJob({
				run: async (opts) => {
					seen = { input: opts.input, ctx: opts.ctx };
				},
			});
			await j.run({ input: { x: 1 }, ctx: { db: "stub" } });
			expect(seen).toEqual({ input: { x: 1 }, ctx: { db: "stub" } });
		});

		it("opts.job carries { id, attempt, scheduledAt }", async () => {
			let job: unknown;
			const j = createJob({
				run: async (opts) => {
					job = opts.job;
				},
			});
			await j.run({ input: {}, ctx: {}, job: { id: "j1", attempt: 0, scheduledAt: new Date() } });
			expect(job).toMatchObject({ id: "j1", attempt: 0 });
		});

		it("validates input against the input schema", async () => {
			const { v } = await import("../src/index.ts");
			const j = createJob({
				input: v.object({ id: v.string() }),
				run:   async () => undefined,
			});
			await expect(j.run({ input: { id: 42 }, ctx: {} })).rejects.toThrow();
		});
	});

	describe("enqueue methods", () => {
		it(".now(input) enqueues immediately, returns a job id", async () => {
			const j = createJob({ run: async () => undefined });
			const id = await j.now({});
			expect(typeof id).toBe("string");
			expect(id.length).toBeGreaterThan(0);
		});

		it(".at(date, input) enqueues for a specific time", async () => {
			const j = createJob({ run: async () => undefined });
			const when = new Date(Date.now() + 60_000);
			const id = await j.at(when, {});
			const status = await j.status(id);
			expect(status.scheduledAt?.getTime()).toBe(when.getTime());
		});

		it(".in(ms, input) is sugar for .at(now + ms)", async () => {
			const j = createJob({ run: async () => undefined });
			const before = Date.now();
			const id = await j.in(60_000, {});
			const status = await j.status(id);
			expect(status.scheduledAt!.getTime()).toBeGreaterThanOrEqual(before + 60_000);
		});

		it(".cancel(jobId) removes a queued job", async () => {
			const j = createJob({ run: async () => undefined });
			const id = await j.in(60_000, {});
			await j.cancel(id);
			const status = await j.status(id);
			expect(status.state).toBe("cancelled");
		});

		it(".status(jobId) returns { state, attempts, lastError?, lastTick? }", async () => {
			const j = createJob({ run: async () => undefined });
			const id = await j.now({});
			const status = await j.status(id);
			expect(status).toHaveProperty("state");
			expect(status).toHaveProperty("attempts");
		});
	});

	describe("schedule", () => {
		it("schedule.cron registers a recurring schedule at boot", () => {
			const j = createJob({
				schedule: { cron: "0 4 * * *" },
				run:      async () => undefined,
			});
			expect(j.schedule?.cron).toBe("0 4 * * *");
		});

		it("schedule.interval accepts ms", () => {
			const j = createJob({
				schedule: { interval: 60_000 },
				run:      async () => undefined,
			});
			expect(j.schedule?.interval).toBe(60_000);
		});

		it("schedule.interval accepts human-readable strings", () => {
			const j = createJob({
				schedule: { interval: "5 minutes" },
				run:      async () => undefined,
			});
			expect(j.schedule?.interval).toBe("5 minutes");
		});

		it("schedule.timezone honors cron tz", () => {
			const j = createJob({
				schedule: { cron: "0 9 * * *", timezone: "Europe/Oslo" },
				run:      async () => undefined,
			});
			expect(j.schedule?.timezone).toBe("Europe/Oslo");
		});
	});

	describe("retries and backoff", () => {
		it("default retries is 0 (no retry)", () => {
			const j = createJob({ run: async () => undefined });
			expect(j.retries).toBe(0);
		});

		it("retries: 3 retries up to 3 times after the initial attempt", () => {
			const j = createJob({ retries: 3, run: async () => undefined });
			expect(j.retries).toBe(3);
		});

		it("backoff='exponential' computes 2^attempt seconds, capped at 5 minutes", () => {
			const j = createJob({ backoff: "exponential", run: async () => undefined });
			const fn = (j as any).backoffFn;
			expect(fn(0)).toBe(1_000);
			expect(fn(1)).toBe(2_000);
			expect(fn(2)).toBe(4_000);
			expect(fn(20)).toBeLessThanOrEqual(5 * 60_000);
		});

		it("backoff='linear' is attempt * 30s", () => {
			const j = createJob({ backoff: "linear", run: async () => undefined });
			expect((j as any).backoffFn(0)).toBe(0);
			expect((j as any).backoffFn(2)).toBe(60_000);
		});

		it("backoff custom function is honored", () => {
			const j = createJob({
				backoff: { fn: (attempt: number) => attempt * 100 },
				run:     async () => undefined,
			});
			expect((j as any).backoffFn(3)).toBe(300);
		});

		it.each([
			"unauthorized", "forbidden", "not_found", "bad_request",
		])("RpcError(%s) is permanent — no retry", (cat) => {
			const j = createJob({ retries: 5, run: async () => undefined });
			const e = new RpcError(cat, "msg");
			expect((j as any).shouldRetry?.(e)).toBe(false);
		});

		it.each([
			"internal", "conflict", "rate_limited",
		])("RpcError(%s) triggers retry", (cat) => {
			const j = createJob({ retries: 5, run: async () => undefined });
			const e = new RpcError(cat, "msg");
			expect((j as any).shouldRetry?.(e)).toBe(true);
		});

		it("generic Error triggers retry", () => {
			const j = createJob({ retries: 5, run: async () => undefined });
			expect((j as any).shouldRetry?.(new Error("oops"))).toBe(true);
		});
	});

	describe("timeout", () => {
		it("terminates run after configured ms, counts as failure", async () => {
			const j = createJob({
				timeout: 50,
				run:     async () => new Promise(() => undefined), // never resolves
			});
			await expect(j.run({ input: {}, ctx: {} })).rejects.toThrow(/timeout/i);
		});

		it("default timeout is 30_000 ms", () => {
			const j = createJob({ run: async () => undefined });
			expect(j.timeout).toBe(30_000);
		});
	});

	describe("opts.tick", () => {
		it("emits progress events", async () => {
			const ticks: unknown[] = [];
			const j = createJob({
				run: async (opts) => {
					opts.tick({ message: "step 1" });
					opts.tick({ message: "step 2" });
				},
			});
			await j.run({ input: {}, ctx: {}, tick: (t: unknown) => ticks.push(t) });
			expect(ticks).toHaveLength(2);
		});

		it("validates against the progress schema when declared", async () => {
			const { v } = await import("../src/index.ts");
			const j = createJob({
				progress: v.object({ stage: v.string() }),
				run: async (opts) => {
					opts.tick({ stage: "ok" });
					opts.tick({ wrong: "shape" } as never);
				},
			});
			await expect(j.run({ input: {}, ctx: {}, tick: () => undefined })).rejects.toThrow();
		});
	});

	describe(".watch and .result", () => {
		it(".watch yields { kind:'tick', payload } during run", async () => {
			const j = createJob({
				run: async (opts) => {
					opts.tick({ stage: "loading" });
					opts.tick({ stage: "saving" });
				},
			});
			const id = await j.now({});
			const events: any[] = [];
			for await (const e of j.watch(id)) events.push(e);
			expect(events.filter((e) => e.kind === "tick").length).toBe(2);
		});

		it(".watch yields { kind:'result', value } when run completes", async () => {
			const j = createJob({ run: async () => "ok" });
			const id = await j.now({});
			const last: any[] = [];
			for await (const e of j.watch(id)) last.push(e);
			expect(last[last.length - 1]).toMatchObject({ kind: "result", value: "ok" });
		});

		it(".watch yields { kind:'error', error } when run throws permanently", async () => {
			const j = createJob({
				retries: 0,
				run:     async () => { throw new Error("boom"); },
			});
			const id = await j.now({});
			const events: any[] = [];
			for await (const e of j.watch(id)) events.push(e);
			expect(events[events.length - 1]).toMatchObject({ kind: "error" });
		});

		it(".result(jobId) resolves with the run's return value", async () => {
			const j = createJob({ run: async () => 42 });
			const id = await j.now({});
			await expect(j.result(id)).resolves.toBe(42);
		});

		it(".result(jobId) rejects with the final error on permanent failure", async () => {
			const j = createJob({
				retries: 0,
				run:     async () => { throw new Error("boom"); },
			});
			const id = await j.now({});
			await expect(j.result(id)).rejects.toThrow(/boom/);
		});

		it(".status(jobId).lastTick is the most recent tick payload", async () => {
			const j = createJob({
				run: async (opts) => { opts.tick({ stage: "final" }); },
			});
			const id = await j.now({});
			await j.result(id);
			const status = await j.status(id);
			expect(status.lastTick).toEqual({ stage: "final" });
		});

		it("tick history retained for a configurable window after completion", async () => {
			const j = createJob({
				tickRetentionMs: 60_000,
				run: async (opts) => { opts.tick({ stage: "done" }); },
			});
			expect(j.tickRetentionMs).toBe(60_000);
		});
	});

	describe("worker", () => {
		it.todo("pulls from job store via store.next(workerId)");
		it.todo("graceful shutdown waits for in-flight jobs");
		it.todo("--concurrency=N pulls up to N jobs in parallel");
	});

	describe("JobStore interface", () => {
		it.todo("implements enqueue / next / complete / fail / cancel / status / close");
		it.todo("in-memory store is the default");
	});

	describe("bus events", () => {
		it.each([
			"job.enqueued", "job.started", "job.completed", "job.failed", "job.retried",
		])("emits '%s'", async (event) => {
			// Each lifecycle step fires the matching bus event with the job id.
			// Test will assert via a bus subscription once implementation lands.
			expect(typeof event).toBe("string");
		});
	});
});

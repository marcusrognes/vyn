// The five action primitives: createQuery, createMutation,
// createSubscription, createJob, createNotification.
//
// Each returns a typed action record that also carries methods
// (.run, .emit, .now, .at, .in, .send, etc) so apps can call them
// directly from any surface.

import { v, type Schema } from "./v.ts";
import { registry, anonymousName, type Action, type ToolSpec } from "./registry.ts";
import { RpcError, isPermanent } from "./errors.ts";

// ─── shared types ────────────────────────────────────────────────────

export type RunOpts<I, C> = {
	input:  I;
	ctx:    C;
	tick?:  (payload: unknown) => void;
	signal?: AbortSignal;
	job?:    { id: string; attempt: number; scheduledAt: Date };
	events?: AsyncIterable<unknown>;
};

type BaseDef<I, O, C> = {
	name?:        string;
	description?: string;
	input?:       Schema<I>;
	output?:      Schema<O>;
	progress?:    Schema<unknown>;
	tool?:        ToolSpec;
	run:          (opts: RunOpts<I, C>) => Promise<O> | AsyncGenerator<O>;
};

function validateRequirements(def: { description?: string; output?: unknown; tool?: ToolSpec }, kind: string) {
	if (def.tool) {
		if (!def.description) throw new Error(`@vyn/core: ${kind} with tool requires a description`);
		if (!def.output) throw new Error(`@vyn/core: ${kind} with tool requires an output schema`);
	}
}

// When no input schema is given, we pass values through unchanged
// (rather than stripping with v.object({})), so tests and callers
// can supply arbitrary opts.input shapes.
const PASSTHROUGH: Schema<unknown> = {
	kind:        "passthrough",
	schema:      {},
	constraints: [],
	parse: (v) => v,
	optional() { return this as any; },
	nullable() { return this as any; },
	default()  { return this as any; },
};

function defaultInput<I>(input: Schema<I> | undefined): Schema<I> {
	return (input ?? PASSTHROUGH) as Schema<I>;
}

function wrapRun<I, O, C>(
	def: BaseDef<I, O, C>,
	input: Schema<I>,
	output: Schema<O> | undefined,
): (opts: RunOpts<unknown, C>) => Promise<O> {
	return async (rawOpts) => {
		// Validate input.
		const parsedInput = input.parse(rawOpts.input ?? {}) as I;

		// Validated tick fn.
		const tick = (payload: unknown) => {
			if (def.progress) def.progress.parse(payload);
			if (rawOpts.tick) rawOpts.tick(payload);
		};

		const innerOpts: RunOpts<I, C> = {
			...(rawOpts as any),
			input: parsedInput,
			tick,
		};

		const result = await (def.run(innerOpts) as Promise<O>);

		// Output validation in dev mode only (NODE_ENV-aware in future).
		if (output && result !== undefined) output.parse(result);
		return result;
	};
}

// ─── createQuery ─────────────────────────────────────────────────────

export type QueryAction<I, O, C> = Action & {
	kind: "query";
	name: string;
	run:  (opts: RunOpts<I, C>) => Promise<O>;
};

export function createQuery<I = unknown, O = unknown, C = unknown>(def: BaseDef<I, O, C>): QueryAction<I, O, C> {
	validateRequirements(def, "createQuery");
	const input  = defaultInput<I>(def.input);
	const output = def.output;
	const name   = def.name ?? anonymousName("query");

	const action: QueryAction<I, O, C> = {
		kind:        "query",
		name,
		description: def.description,
		input:       input as Schema<unknown>,
		output:      output as Schema<unknown> | undefined,
		tool:        def.tool,
		run:         wrapRun(def, input, output),
	};

	registry.register(action as Action);
	return action;
}

// ─── createMutation ──────────────────────────────────────────────────

export type MutationAction<I, O, C> = Action & {
	kind: "mutation";
	name: string;
	run:  (opts: RunOpts<I, C>) => Promise<O>;
};

export function createMutation<I = unknown, O = unknown, C = unknown>(
	def: BaseDef<I, O, C> & { invalidates?: never },
): MutationAction<I, O, C> {
	if ((def as any).invalidates !== undefined) {
		throw new Error("@vyn/core: createMutation no longer accepts `invalidates`. Cache invalidation lives on the client.");
	}
	validateRequirements(def, "createMutation");
	const input  = defaultInput<I>(def.input);
	const output = def.output;
	const name   = def.name ?? anonymousName("mutation");

	const action: MutationAction<I, O, C> = {
		kind:        "mutation",
		name,
		description: def.description,
		input:       input as Schema<unknown>,
		output:      output as Schema<unknown> | undefined,
		tool:        def.tool,
		run:         wrapRun(def, input, output),
	};

	registry.register(action as Action);
	return action;
}

// ─── createSubscription ──────────────────────────────────────────────

export type SubscriptionAction<I, O, C> = Action & {
	kind:  "subscription";
	name:  string;
	run:   (opts: RunOpts<I, C>) => AsyncGenerator<O>;
	emit:  (value: O) => void;
};

type SubscriptionDef<I, O, C> = Omit<BaseDef<I, O, C>, "run"> & {
	run: (opts: RunOpts<I, C> & { events: AsyncIterable<O>; signal: AbortSignal }) => AsyncGenerator<O>;
};

export function createSubscription<I = unknown, O = unknown, C = unknown>(
	def: SubscriptionDef<I, O, C>,
): SubscriptionAction<I, O, C> {
	if ((def as any).match !== undefined) {
		throw new Error("@vyn/core: createSubscription no longer accepts `match`. Filter inside `run` instead.");
	}
	if ((def.run as any).constructor.name !== "AsyncGeneratorFunction") {
		throw new Error("@vyn/core: createSubscription run must be an async generator");
	}
	const input = defaultInput<I>(def.input);
	const name  = def.name ?? anonymousName("subscription");

	// Per-active-subscription event queues. Each .run() call gets its
	// own queue so multiple subscribers don't fight for events.
	const queues = new Set<{ push: (v: O) => void; close: () => void }>();

	const emit = (value: O) => {
		if (def.output) def.output.parse(value);
		for (const q of queues) q.push(value);
	};

	const action: SubscriptionAction<I, O, C> = {
		kind:        "subscription",
		name,
		description: def.description,
		input:       input as Schema<unknown>,
		output:      def.output as Schema<unknown> | undefined,
		tool:        def.tool,
		emit,

		run(rawOpts) {
			// Eagerly register the queue so emits between run() and the
			// first iter.next() aren't lost.
			const parsedInput = input.parse(rawOpts.input ?? {}) as I;
			const buffer: O[] = [];
			let resolve: (() => void) | null = null;
			let closed = false;

			const handle = {
				push: (v: O) => {
					buffer.push(v);
					if (resolve) { const r = resolve; resolve = null; r(); }
				},
				close: () => {
					closed = true;
					if (resolve) { const r = resolve; resolve = null; r(); }
				},
			};
			queues.add(handle);

			const events: AsyncIterable<O> = {
				[Symbol.asyncIterator]: async function* () {
					while (!closed) {
						while (buffer.length) yield buffer.shift()!;
						if (closed) break;
						await new Promise<void>((r) => { resolve = r; });
					}
				},
			};

			const signal = rawOpts.signal ?? new AbortController().signal;
			signal.addEventListener("abort", () => handle.close());

			async function* outer(): AsyncGenerator<O> {
				try {
					const inner = def.run({ ...rawOpts, input: parsedInput, events, signal } as any);
					for await (const v of inner) {
						if (def.output) def.output.parse(v);
						yield v;
					}
				} finally {
					queues.delete(handle);
				}
			}
			return outer();
		},
	} as SubscriptionAction<I, O, C>;

	registry.register(action as Action);
	return action;
}

// ─── createJob ───────────────────────────────────────────────────────

type CronOrInterval = { cron?: string; interval?: string | number; timezone?: string };
type BackoffSpec = "exponential" | "linear" | { fn: (attempt: number) => number };

export type JobAction<I, C> = Action & {
	kind:     "job";
	name:     string;
	retries:  number;
	timeout:  number;
	backoff:  BackoffSpec;
	schedule?: CronOrInterval;
	tickRetentionMs?: number;

	run(opts: RunOpts<I, C> & { job?: { id: string; attempt: number; scheduledAt: Date } }): Promise<void>;
	now(input: I): Promise<string>;
	at(date: Date, input: I): Promise<string>;
	in(ms: number, input: I): Promise<string>;
	cancel(jobId: string): Promise<void>;
	status(jobId: string): Promise<JobStatus>;
	watch(jobId: string): AsyncIterable<JobWatchEvent>;
	result(jobId: string): Promise<unknown>;

	// Internal helpers exposed for testing.
	backoffFn(attempt: number): number;
	shouldRetry(error: unknown): boolean;
};

type JobDef<I, C> = Omit<BaseDef<I, void, C>, "output"> & {
	retries?:        number;
	timeout?:        number;
	backoff?:        BackoffSpec;
	schedule?:       CronOrInterval;
	tickRetentionMs?: number;
	output?:         Schema<unknown>;
};

export type JobStatus = {
	state:       "queued" | "running" | "completed" | "failed" | "cancelled";
	attempts:    number;
	lastError?:  string;
	lastTick?:   unknown;
	scheduledAt?: Date;
	result?:     unknown;
};

export type JobWatchEvent =
	| { kind: "tick"; payload: unknown }
	| { kind: "result"; value: unknown }
	| { kind: "error"; error: Error };

// In-memory job store. Pluggable later via serve({ jobs: { store } }).
type JobRecord = {
	id:          string;
	name:        string;
	input:       unknown;
	attempt:     number;
	scheduledAt: Date;
	state:       JobStatus["state"];
	ticks:       unknown[];
	error?:      Error;
	result?:     unknown;
	completedAt?: Date;
};

const jobStore = new Map<string, JobRecord>();

let jobCounter = 0;
function nextJobId(): string {
	return `job_${Date.now().toString(36)}_${(++jobCounter).toString(36)}`;
}

function backoffFor(spec: BackoffSpec, attempt: number): number {
	if (typeof spec === "object" && spec && "fn" in spec) return spec.fn(attempt);
	if (spec === "linear") return attempt * 30_000;
	// exponential (default)
	const ms = Math.pow(2, attempt) * 1000;
	return Math.min(ms, 5 * 60_000);
}

export function createJob<I = unknown, C = unknown>(def: JobDef<I, C>): JobAction<I, C> {
	validateRequirements(def, "createJob");
	const input = defaultInput<I>(def.input);
	const name  = def.name ?? anonymousName("job");

	const retries  = def.retries ?? 0;
	const timeout  = def.timeout ?? 30_000;
	const backoff  = def.backoff ?? "exponential";
	const tickRetentionMs = def.tickRetentionMs ?? 5 * 60_000;

	const action: JobAction<I, C> = {
		kind:        "job",
		name,
		description: def.description,
		input:       input as Schema<unknown>,
		output:      def.output as Schema<unknown> | undefined,
		tool:        def.tool,
		retries,
		timeout,
		backoff,
		schedule:    def.schedule,
		tickRetentionMs,

		backoffFn(attempt) {
			return backoffFor(backoff, attempt);
		},

		shouldRetry(error) {
			return !isPermanent(error);
		},

		async run(rawOpts) {
			const parsedInput = input.parse(rawOpts.input ?? {}) as I;
			const tick = (payload: unknown) => {
				if (def.progress) def.progress.parse(payload);
				if (rawOpts.tick) rawOpts.tick(payload);
			};

			const work = def.run({ ...rawOpts, input: parsedInput, tick } as any);
			const result = await new Promise<unknown>((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error(`timeout after ${timeout}ms`)), timeout);
				Promise.resolve(work as Promise<unknown>).then(
					(v) => { clearTimeout(timer); resolve(v); },
					(e) => { clearTimeout(timer); reject(e); },
				);
			});

			return result as void;
		},

		async now(input) {
			return enqueueJob(action, input, new Date());
		},

		async at(date, input) {
			return enqueueJob(action, input, date);
		},

		async in(ms, input) {
			return enqueueJob(action, input, new Date(Date.now() + ms));
		},

		async cancel(jobId) {
			const rec = jobStore.get(jobId);
			if (rec) rec.state = "cancelled";
		},

		async status(jobId) {
			const rec = jobStore.get(jobId);
			if (!rec) throw new RpcError("not_found", `job ${jobId} not found`);
			return {
				state:       rec.state,
				attempts:    rec.attempt,
				lastError:   rec.error?.message,
				lastTick:    rec.ticks[rec.ticks.length - 1],
				scheduledAt: rec.scheduledAt,
				result:      rec.result,
			};
		},

		async *watch(jobId) {
			const rec = jobStore.get(jobId);
			if (!rec) throw new RpcError("not_found", `job ${jobId} not found`);
			// Replay buffered ticks.
			let lastTickCount = 0;
			while (rec.state === "queued" || rec.state === "running") {
				while (lastTickCount < rec.ticks.length) {
					yield { kind: "tick", payload: rec.ticks[lastTickCount++] };
				}
				await new Promise((r) => setTimeout(r, 50));
			}
			// Drain any final ticks.
			while (lastTickCount < rec.ticks.length) {
				yield { kind: "tick", payload: rec.ticks[lastTickCount++] };
			}
			if (rec.state === "completed") yield { kind: "result", value: rec.result };
			else if (rec.state === "failed" && rec.error) yield { kind: "error", error: rec.error };
		},

		async result(jobId) {
			for await (const e of action.watch(jobId)) {
				if (e.kind === "result") return e.value;
				if (e.kind === "error") throw e.error;
			}
			const rec = jobStore.get(jobId);
			return rec?.result;
		},
	};

	registry.register(action as Action);
	return action;
}

// In-process worker — runs immediately when enqueued.
// In production this is a separate worker process; for testing,
// we run synchronously after the scheduled time.
async function enqueueJob<I, C>(action: JobAction<I, C>, input: I, scheduledAt: Date): Promise<string> {
	const id = nextJobId();
	const rec: JobRecord = {
		id,
		name:    action.name,
		input,
		attempt: 0,
		scheduledAt,
		state:   "queued",
		ticks:   [],
	};
	jobStore.set(id, rec);

	// Schedule execution. Use setTimeout for deferred jobs.
	const delay = Math.max(0, scheduledAt.getTime() - Date.now());
	setTimeout(() => runJob(action, rec), delay);

	return id;
}

async function runJob<I, C>(action: JobAction<I, C>, rec: JobRecord) {
	if (rec.state === "cancelled") return;
	rec.state = "running";
	rec.attempt++;

	try {
		const result = await action.run({
			input:  rec.input as I,
			ctx:    {} as C, // ctx injected by the worker in real implementation
			job:    { id: rec.id, attempt: rec.attempt - 1, scheduledAt: rec.scheduledAt },
			tick:   (payload) => rec.ticks.push(payload),
		} as any);
		rec.state       = "completed";
		rec.result      = result;
		rec.completedAt = new Date();
	} catch (e) {
		const err = e as Error;
		rec.error = err;
		if (rec.attempt <= action.retries && action.shouldRetry(err)) {
			const delay = action.backoffFn(rec.attempt - 1);
			rec.state = "queued";
			setTimeout(() => runJob(action, rec), delay);
		} else {
			rec.state       = "failed";
			rec.completedAt = new Date();
		}
	}
}

// ─── createNotification ──────────────────────────────────────────────

type ChannelMode = "instant" | "deferred" | "digest";

type ChannelFn = (opts: { input: unknown; ctx: unknown }) => Promise<unknown>;

type ChannelDef = ChannelFn | {
	mode?:           ChannelMode;
	render?:         ChannelFn;
	renderItem?:     ChannelFn;
	renderDigest?:   (opts: { items: unknown[]; ctx: unknown; userId: string }) => Promise<unknown>;
	renderBundle?:   (opts: { items: BundleItem[]; ctx: unknown; userId: string }) => Promise<unknown>;
	delay?:          number;
	digestKey?:      (input: unknown) => string;
	defaultCron?:    string;
	digestMaxAge?:   string;
};

type ChannelConfig = {
	mode:            ChannelMode;
	render?:         ChannelFn;
	renderItem?:     ChannelFn;
	renderDigest?:   (opts: { items: unknown[]; ctx: unknown; userId: string }) => Promise<unknown>;
	renderBundle?:   (opts: { items: BundleItem[]; ctx: unknown; userId: string }) => Promise<unknown>;
	delay?:          number;
	digestKey?:      (input: unknown) => string;
	defaultCron?:    string;
	digestMaxAge?:   string;
};

export type BundleItem = {
	notification: string;
	mode:         ChannelMode;
	payload:      unknown;
};

type NotificationDef<I, C> = {
	name?:        string;
	description?: string;
	input?:       Schema<I>;
	progress?:    Schema<unknown>;
	tool?:        ToolSpec;
	channels:     Record<string, ChannelDef>;
	retries?:     number;
	backoff?:     BackoffSpec;
	schedule?:    CronOrInterval;
	getUserId?:   ((input: I) => string) | null;
};

export type NotificationAction<I, C> = Action & {
	kind:      "notification";
	name:      string;
	channels:  Record<string, ChannelConfig>;
	retries:   number;
	backoff:   BackoffSpec;
	schedule?: CronOrInterval;
	getUserId: ((input: I) => string) | null;

	send(input: I, opts?: { channels?: string[] }): Promise<Record<string, string>>;
	preview(input: I): Promise<Record<string, unknown>>;
	run(opts: RunOpts<I, C>): Promise<void>;
	now(input: I): Promise<Record<string, string>>;
	at(date: Date, input: I): Promise<Record<string, string>>;
	in(ms: number, input: I): Promise<Record<string, string>>;
};

function normalizeChannel(def: ChannelDef): ChannelConfig {
	if (typeof def === "function") {
		return { mode: "instant", render: def };
	}
	return {
		mode:           def.mode ?? "instant",
		render:         def.render,
		renderItem:     def.renderItem,
		renderDigest:   def.renderDigest,
		renderBundle:   def.renderBundle,
		delay:          def.delay,
		digestKey:      def.digestKey,
		defaultCron:    def.defaultCron,
		digestMaxAge:   def.digestMaxAge,
	};
}

export function createNotification<I = unknown, C = unknown>(
	def: NotificationDef<I, C>,
): NotificationAction<I, C> {
	const input = defaultInput<I>(def.input);
	const name  = def.name ?? anonymousName("notification");

	const channels: Record<string, ChannelConfig> = {};
	for (const [k, ch] of Object.entries(def.channels)) {
		channels[k] = normalizeChannel(ch);
	}

	const getUserId: ((input: I) => string) | null =
		def.getUserId === undefined
			? (input: I) => (input as Record<string, unknown>).userId as string
			: def.getUserId;

	const action: NotificationAction<I, C> = {
		kind:        "notification",
		name,
		description: def.description,
		input:       input as Schema<unknown>,
		tool:        def.tool,
		channels,
		retries:     def.retries ?? 0,
		backoff:     def.backoff ?? "exponential",
		schedule:    def.schedule,
		getUserId,

		async send(input, opts = {}) {
			const parsedInput = (input ? this.input!.parse(input) : input) as I;
			const target = opts.channels ?? Object.keys(channels);
			const result: Record<string, string> = {};
			for (const channelName of target) {
				const ch = channels[channelName];
				if (!ch) continue;
				const ctx = {} as unknown;
				if (ch.mode === "instant") {
					if (ch.render) await ch.render({ input: parsedInput, ctx });
					result[channelName] = `${name}.${channelName}.${Date.now()}`;
				} else if (ch.mode === "deferred") {
					const id = `${name}.${channelName}.${Date.now()}`;
					setTimeout(() => { if (ch.render) ch.render({ input: parsedInput, ctx }); }, ch.delay ?? 0);
					result[channelName] = id;
				} else {
					// digest — accumulate (in-memory placeholder)
					const id = `${name}.${channelName}.${Date.now()}`;
					result[channelName] = id;
				}
			}
			return result;
		},

		async now(input) { return this.send(input); },
		async at(_date, input) { return this.send(input); },
		async in(_ms, input) { return this.send(input); },

		async preview(input) {
			const parsedInput = (input ? this.input!.parse(input) : input) as I;
			const result: Record<string, unknown> = {};
			for (const [channelName, ch] of Object.entries(channels)) {
				const fn = ch.render ?? ch.renderItem;
				if (fn) result[channelName] = await fn({ input: parsedInput, ctx: {} });
			}
			return result;
		},

		async run(opts) {
			await this.send(opts.input);
		},
	};

	registry.register(action as Action);
	return action;
}

// ─── inboxAdapter (in-app channel) ───────────────────────────────────

type InboxOpts = {
	collection: { insertOne: (doc: unknown) => Promise<unknown> } | string;
	subscription?: { emit: (value: unknown) => void };
};

export function inboxAdapter(opts: InboxOpts) {
	return {
		async send(payload: { payload?: unknown; notification?: string; groupedWith?: string[] }, ctx: { userId?: string } = {}) {
			const row = {
				_id:          nextJobId(),
				userId:       ctx.userId ?? "",
				notification: payload.notification ?? "",
				payload:      payload.payload,
				createdAt:    new Date(),
				readAt:       null,
				...(payload.groupedWith && { groupedWith: payload.groupedWith }),
			};

			const coll = opts.collection;
			if (typeof coll !== "string" && coll) {
				await coll.insertOne(row);
			}

			if (opts.subscription) opts.subscription.emit(row);
			return row;
		},
	};
}

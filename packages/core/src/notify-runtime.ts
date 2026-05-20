// Singleton notification runtime. createNotification.send() routes
// through here. serve({ notify }) installs adapters + preferences +
// coalesce window + starts the flush loop.
//
// Responsibilities:
//   - Resolve channel adapter for a (user, channel) pair, honoring
//     preferences (enabled / mode override / digest schedule override).
//   - Maintain per-(user, channel) queues for deferred + digest items.
//   - Run a flush loop that drains items whose due-time has passed,
//     bundling everything due within `coalesceWindowMs` into one
//     adapter call (or one per source for `instant`).

import { parseCron, previousTick } from "./cron.ts";

export type NotificationAdapter = {
	send(payload: unknown, ctx: unknown): Promise<void>;
};

export type ChannelPreference = {
	enabled: boolean;
	mode?:   "instant" | "deferred" | "digest";
	delay?:  number;
	digest?: { cron: string; timezone: string } | null;
};

export type PreferencesResolver = (
	userId: string,
	ctx: unknown,
	notificationName: string,
) => Promise<Record<string, ChannelPreference>> | Record<string, ChannelPreference>;

type ChannelConfig = {
	mode:           "instant" | "deferred" | "digest";
	render?:        (opts: { input: unknown; ctx: unknown }) => Promise<unknown>;
	renderItem?:    (opts: { input: unknown; ctx: unknown }) => Promise<unknown>;
	renderDigest?:  (opts: { items: unknown[]; ctx: unknown; userId: string }) => Promise<unknown>;
	renderBundle?:  (opts: { items: BundleItem[]; ctx: unknown; userId: string }) => Promise<unknown>;
	delay?:         number;
	digestKey?:     (input: unknown) => string;
	defaultCron?:   string;
	digestMaxAge?:  string;
};

type NotificationRef = {
	name:      string;
	channels:  Record<string, ChannelConfig>;
	getUserId: ((input: unknown) => string) | null;
};

export type BundleItem = {
	notification: string;
	mode:         "deferred" | "digest";
	payload:      unknown;
	enqueuedAt:   Date;
};

type QueueItem = {
	notification: NotificationRef;
	channel:      string;
	mode:         "deferred" | "digest";
	payload:      unknown;
	enqueuedAt:   Date;
	dueAt?:       Date;     // for deferred: enqueuedAt + delay
	digestKey:    string;
	userId:       string;
};

type RuntimeState = {
	adapters:         Record<string, NotificationAdapter>;
	preferences:      PreferencesResolver | null;
	coalesceWindowMs: number;
	queues:           Map<string, QueueItem[]>;          // key = `${userId}|${channel}`
	lastFlushAt:      Map<string, Date>;                  // key = `${userId}|${notificationName}|${channel}`
	flushTimer:       ReturnType<typeof setInterval> | null;
	installed:        boolean;
};

const state: RuntimeState = {
	adapters:         {},
	preferences:      null,
	coalesceWindowMs: 60_000,
	queues:           new Map(),
	lastFlushAt:      new Map(),
	flushTimer:       null,
	installed:        false,
};

export function installNotify(opts: {
	adapters?:         Record<string, NotificationAdapter>;
	preferences?:      PreferencesResolver;
	coalesceWindowMs?: number;
}) {
	if (opts.adapters)         state.adapters         = { ...state.adapters, ...opts.adapters };
	if (opts.preferences)      state.preferences      = opts.preferences;
	if (opts.coalesceWindowMs !== undefined) state.coalesceWindowMs = opts.coalesceWindowMs;
	state.installed = true;
	startFlushLoop();
}

export function shutdownNotify() {
	if (state.flushTimer) clearInterval(state.flushTimer);
	state.flushTimer = null;
}

function startFlushLoop() {
	if (state.flushTimer) return;
	state.flushTimer = setInterval(() => { void flushNow(); }, 60_000);
}

function queueKey(userId: string, channel: string) {
	return `${userId}|${channel}`;
}

function flushKey(userId: string, notification: string, channel: string) {
	return `${userId}|${notification}|${channel}`;
}

async function resolvePreference(userId: string | null, ctx: unknown, notificationName: string, channel: string, declared: ChannelConfig): Promise<ChannelPreference> {
	if (!userId || !state.preferences) {
		return { enabled: true, mode: declared.mode };
	}
	const all = await state.preferences(userId, ctx, notificationName);
	return all[channel] ?? { enabled: true, mode: declared.mode };
}

export async function dispatchNotification(opts: {
	notification: NotificationRef;
	input:        unknown;
	ctx:          unknown;
	channels?:    string[];
}): Promise<Record<string, string>> {
	const { notification, input, ctx } = opts;
	const target = opts.channels ?? Object.keys(notification.channels);
	const userId = notification.getUserId ? notification.getUserId(input) : null;
	const result: Record<string, string> = {};
	const now = new Date();

	for (const channelName of target) {
		const declared = notification.channels[channelName];
		if (!declared) continue;
		const pref = await resolvePreference(userId, ctx, notification.name, channelName, declared);
		if (pref.enabled === false) continue;

		const effectiveMode = pref.mode ?? declared.mode;

		if (effectiveMode === "instant") {
			const payload = declared.render ? await declared.render({ input, ctx }) : input;
			const id = `${notification.name}.${channelName}.${now.getTime()}`;
			result[channelName] = id;
			void deliver(channelName, payload, { ...(ctx as object), userId });
			continue;
		}

		if (effectiveMode === "deferred") {
			const payload = declared.render ? await declared.render({ input, ctx }) : input;
			const delay   = pref.delay ?? declared.delay ?? 0;
			enqueue({
				notification,
				channel:    channelName,
				mode:       "deferred",
				payload,
				enqueuedAt: now,
				dueAt:      new Date(now.getTime() + delay),
				digestKey:  userId ?? "global",
				userId:     userId ?? "",
			});
			const id = `${notification.name}.${channelName}.${now.getTime()}`;
			result[channelName] = id;
			continue;
		}

		// digest
		const itemPayload = declared.renderItem ? await declared.renderItem({ input, ctx }) : input;
		const key = declared.digestKey ? declared.digestKey(input) : userId ?? "global";
		enqueue({
			notification,
			channel:    channelName,
			mode:       "digest",
			payload:    itemPayload,
			enqueuedAt: now,
			digestKey:  key,
			userId:     userId ?? "",
		});
		const id = `${notification.name}.${channelName}.${now.getTime()}`;
		result[channelName] = id;
	}

	return result;
}

function enqueue(item: QueueItem) {
	const key = queueKey(item.userId, item.channel);
	let q = state.queues.get(key);
	if (!q) { q = []; state.queues.set(key, q); }
	q.push(item);

	// For deferred items, schedule a wake-up so flushes don't have to
	// wait a full minute.
	if (item.mode === "deferred" && item.dueAt) {
		const delay = Math.max(0, item.dueAt.getTime() - Date.now());
		setTimeout(() => { void flushNow(item.userId, item.channel); }, delay + 50);
	}
}

async function deliver(channel: string, payload: unknown, ctx: unknown) {
	const adapter = state.adapters[channel];
	if (!adapter) { console.warn(`[vyn/notify] no adapter for channel '${channel}'`); return; }
	try { await adapter.send(payload, ctx); }
	catch (e) { console.error(`[vyn/notify] adapter '${channel}' failed:`, e); }
}

/** Process pending items, optionally scoped to a single (user, channel). */
export async function flushNow(onlyUser?: string, onlyChannel?: string): Promise<void> {
	const now = new Date();

	for (const [key, items] of [...state.queues.entries()]) {
		const [userId, channel] = key.split("|");
		if (onlyUser    && userId  !== onlyUser)    continue;
		if (onlyChannel && channel !== onlyChannel) continue;
		if (!items.length) continue;

		const due: QueueItem[] = [];
		const remaining: QueueItem[] = [];

		// Determine readiness per-item.
		for (const item of items) {
			let isDue = false;

			if (item.mode === "deferred") {
				isDue = (item.dueAt?.getTime() ?? 0) <= now.getTime();
			} else if (item.mode === "digest") {
				// Resolve user preference for THIS notification + channel.
				const pref = await resolvePreference(item.userId, /* ctx */ {}, item.notification.name, item.channel, item.notification.channels[item.channel]);
				const sched = pref.digest === undefined
					? { cron: item.notification.channels[item.channel].defaultCron ?? "0 8 * * *", timezone: "UTC" }
					: pref.digest;
				if (sched === null) { continue; }

				const tick = previousTick(parseCron(sched.cron), now, sched.timezone);
				const fk   = flushKey(item.userId, item.notification.name, item.channel);
				const last = state.lastFlushAt.get(fk);
				if (tick && (!last || last.getTime() < tick.getTime())) {
					isDue = true;
				}
			}

			(isDue ? due : remaining).push(item);
		}

		// Coalesce: anything not-already-due but within the coalesce window of a due
		// item gets pulled into the same bundle.
		if (due.length) {
			const oldestDueTime = Math.min(...due.map((d) => d.dueAt?.getTime() ?? d.enqueuedAt.getTime()));
			const windowEnd     = oldestDueTime + state.coalesceWindowMs;
			for (let i = remaining.length - 1; i >= 0; i--) {
				const item = remaining[i];
				const eta  = item.dueAt?.getTime() ?? item.enqueuedAt.getTime();
				if (eta <= windowEnd) {
					due.push(item);
					remaining.splice(i, 1);
				}
			}
		}

		// Update queue.
		if (remaining.length) state.queues.set(key, remaining);
		else                  state.queues.delete(key);

		if (!due.length) continue;

		// Update lastFlushAt for digest items.
		for (const item of due) {
			if (item.mode === "digest") {
				state.lastFlushAt.set(flushKey(item.userId, item.notification.name, item.channel), now);
			}
		}

		// Build bundle + render.
		const bundleItems: BundleItem[] = due.map((d) => ({
			notification: d.notification.name,
			mode:         d.mode,
			payload:      d.payload,
			enqueuedAt:   d.enqueuedAt,
		}));

		// Group by source notification to pick the right renderBundle.
		const sources = [...new Set(due.map((d) => d.notification))];
		let payload: unknown;
		if (sources.length === 1 && due.every((d) => d.notification === sources[0])) {
			const src = sources[0];
			const ch  = src.channels[channel];
			if (due.every((d) => d.mode === "digest") && ch.renderDigest) {
				payload = await ch.renderDigest({ items: due.map((d) => d.payload), ctx: {}, userId });
			} else if (ch.renderBundle) {
				payload = await ch.renderBundle({ items: bundleItems, ctx: {}, userId });
			} else if (due.length === 1) {
				payload = due[0].payload;
			} else {
				payload = { items: bundleItems };
			}
		} else {
			// Mixed-source bundle. Use any source's renderBundle if defined,
			// otherwise fall back to default shape.
			const renderer = sources.map((s) => s.channels[channel].renderBundle).find(Boolean);
			payload = renderer
				? await renderer({ items: bundleItems, ctx: {}, userId })
				: { items: bundleItems };
		}

		await deliver(channel, payload, { userId });
	}
}

// Test-only resets.
export function _resetNotifyRuntime() {
	state.queues.clear();
	state.lastFlushAt.clear();
	if (state.flushTimer) clearInterval(state.flushTimer);
	state.flushTimer = null;
	state.adapters = {};
	state.preferences = null;
	state.coalesceWindowMs = 60_000;
	state.installed = false;
}

export function _getQueueSize(): number {
	let n = 0;
	for (const q of state.queues.values()) n += q.length;
	return n;
}

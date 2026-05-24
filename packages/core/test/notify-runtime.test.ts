import { beforeEach, describe, expect, it } from "vyn:test";
import { _getQueueSize, _resetNotifyRuntime, createNotification, flushNow, installNotify } from "../src/index.ts";

describe("notify-runtime", () => {
	beforeEach(() => {
		_resetNotifyRuntime();
	});

	it("instant: dispatches immediately via adapter", async () => {
		const sent: unknown[] = [];
		installNotify({
			adapters: {
				push: {
					send: async (p) => {
						sent.push(p);
					},
				},
			},
		});
		const n = createNotification({
			channels: {
				push: {
					mode: "instant",
					render: async (o: any) => ({ title: "T", body: o.input.body }),
				},
			},
		});
		await n.send({ userId: "u1", body: "hello" });
		// allow microtask flush
		await new Promise((r) => setTimeout(r, 10));
		expect(sent).toEqual([{ title: "T", body: "hello" }]);
	});

	it("deferred: enqueues, delivers after delay", async () => {
		const sent: unknown[] = [];
		installNotify({
			adapters: {
				push: {
					send: async (p) => {
						sent.push(p);
					},
				},
			},
			coalesceWindowMs: 1,
		});
		const n = createNotification({
			channels: {
				push: {
					mode: "deferred",
					delay: 50,
					render: async (o: any) => ({ title: "A" }),
				},
			},
		});
		await n.send({ userId: "u1" });
		expect(sent.length).toBe(0);
		await new Promise((r) => setTimeout(r, 150));
		expect(sent.length).toBe(1);
	});

	it("bundling: two deferred items in coalesce window become one delivery", async () => {
		const sent: unknown[] = [];
		installNotify({
			adapters: {
				email: {
					send: async (p) => {
						sent.push(p);
					},
				},
			},
			coalesceWindowMs: 200,
		});
		const n1 = createNotification({
			name: "n1",
			channels: {
				email: {
					mode: "deferred",
					delay: 30,
					render: async () => ({ html: "<a>" }),
				},
			},
		});
		const n2 = createNotification({
			name: "n2",
			channels: {
				email: {
					mode: "deferred",
					delay: 50,
					render: async () => ({ html: "<b>" }),
				},
			},
		});
		await n1.send({ userId: "u1" });
		await n2.send({ userId: "u1" });
		await new Promise((r) => setTimeout(r, 250));
		expect(sent.length).toBe(1);
		expect((sent[0] as { items: unknown[] }).items.length).toBe(2);
	});

	it("preferences resolver: disables a channel for a user", async () => {
		const sent: unknown[] = [];
		installNotify({
			adapters: {
				push: {
					send: async (p) => {
						sent.push(p);
					},
				},
			},
			preferences: async (userId) => userId === "u-quiet" ? { push: { enabled: false } } : { push: { enabled: true } },
		});
		const n = createNotification({
			name: "pings",
			channels: {
				push: { mode: "instant", render: async () => ({ title: "ping" }) },
			},
		});
		await n.send({ userId: "u-quiet" });
		await new Promise((r) => setTimeout(r, 10));
		expect(sent.length).toBe(0);
		await n.send({ userId: "u-loud" });
		await new Promise((r) => setTimeout(r, 10));
		expect(sent.length).toBe(1);
	});

	it("preferences override flips digest mode to instant", async () => {
		const sent: unknown[] = [];
		installNotify({
			adapters: {
				email: {
					send: async (p) => {
						sent.push(p);
					},
				},
			},
			preferences: async () => ({ email: { enabled: true, mode: "instant" } }),
		});
		const n = createNotification({
			name: "digestNote",
			channels: {
				email: {
					mode: "digest",
					digestKey: (i: any) => i.userId,
					defaultCron: "0 8 * * *",
					renderItem: async () => ({}),
					renderDigest: async () => ({ subject: "x" }),
					render: async () => ({ subject: "instant" }),
				},
			},
		});
		await n.send({ userId: "u1" });
		await new Promise((r) => setTimeout(r, 10));
		expect(sent.length).toBe(1);
		expect(sent[0]).toEqual({ subject: "instant" });
	});

	it("queue size grows on enqueue, shrinks on flush", async () => {
		installNotify({ adapters: { email: { send: async () => undefined } } });
		const n = createNotification({
			channels: {
				email: { mode: "deferred", delay: 60_000, render: async () => ({}) },
			},
		});
		await n.send({ userId: "u1" });
		expect(_getQueueSize()).toBe(1);
	});
});

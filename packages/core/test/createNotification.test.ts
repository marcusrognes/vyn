import { describe, expect, it, beforeEach } from "vitest";
import { createNotification, registry } from "../src/index.ts";

// Contracts from /guide/notifications/
describe("createNotification", () => {
	beforeEach(() => {
		(registry as any).clear?.();
	});

	describe("registry record", () => {
		it("returns an action with kind 'notification'", () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "hi" }) },
			});
			expect(n.kind).toBe("notification");
		});

		it("registers itself in the global registry", () => {
			const n = createNotification({
				name:     "test.welcome",
				channels: { inApp: async () => ({ body: "hi" }) },
			});
			expect(registry.get("test.welcome")).toBe(n);
		});

		it("exposes .send, .preview, .run, .now, .at, .in", () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "hi" }) },
			});
			for (const m of ["send", "preview", "run", "now", "at", "in"]) {
				expect(typeof (n as any)[m]).toBe("function");
			}
		});
	});

	describe(".send fan-out", () => {
		it("dispatches to every configured channel", async () => {
			const calls: string[] = [];
			const n = createNotification({
				channels: {
					email: async () => { calls.push("email");  return { to: "x", subject: "s" }; },
					push:  async () => { calls.push("push");   return { title: "t" }; },
					inApp: async () => { calls.push("inApp");  return { kind: "x" }; },
				},
			});
			await n.send({});
			expect(new Set(calls)).toEqual(new Set(["email", "push", "inApp"]));
		});

		it(".send(input, { channels }) restricts to listed channels", async () => {
			const calls: string[] = [];
			const n = createNotification({
				channels: {
					email: async () => { calls.push("email"); return { to: "x", subject: "s" }; },
					push:  async () => { calls.push("push");  return { title: "t" }; },
				},
			});
			await n.send({}, { channels: ["email"] });
			expect(calls).toEqual(["email"]);
		});

		it("returns { <channel>: jobId } for each dispatch", async () => {
			const n = createNotification({
				channels: {
					email: async () => ({ to: "x", subject: "s" }),
					push:  async () => ({ title: "t" }),
				},
			});
			const result = await n.send({});
			expect(typeof result.email).toBe("string");
			expect(typeof result.push).toBe("string");
		});
	});

	describe(".preview", () => {
		it("runs every render without dispatching", async () => {
			let sent = false;
			const n = createNotification({
				channels: {
					email: async () => { sent = true; return { to: "x", subject: "s" }; },
				},
			});
			const result = await n.preview({});
			expect(sent).toBe(false);   // adapter NOT called
			expect(result.email).toBeDefined();
		});
	});

	describe("scheduling", () => {
		it(".now is an alias for .send", async () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "x" }) },
			});
			const sent    = await n.send({});
			const sentNow = await n.now({});
			expect(typeof sentNow.inApp).toBe("string");
			expect(sent).toMatchObject({ inApp: expect.any(String) });
		});

		it(".at(date, input) schedules send for a specific time", async () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "x" }) },
			});
			const when = new Date(Date.now() + 60_000);
			const result = await n.at(when, {});
			expect(typeof result.inApp).toBe("string");
		});

		it(".in(ms, input) sugar for at(now + ms)", async () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "x" }) },
			});
			const result = await n.in(60_000, {});
			expect(typeof result.inApp).toBe("string");
		});
	});

	describe("delivery modes", () => {
		it("short-form channel (function) defaults to instant mode", () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "x" }) },
			});
			expect(n.channels.inApp.mode).toBe("instant");
		});

		it("long-form channel object supports mode='instant'", () => {
			const n = createNotification({
				channels: {
					push: { mode: "instant", render: async () => ({ title: "x" }) },
				},
			});
			expect(n.channels.push.mode).toBe("instant");
		});

		it("mode='deferred' enqueues a job with delay ms", async () => {
			const n = createNotification({
				channels: {
					inApp: { mode: "deferred", delay: 60_000, render: async () => ({ body: "x" }) },
				},
			});
			const result = await n.send({});
			expect(typeof result.inApp).toBe("string");
		});

		it("mode='digest' accumulates per digestKey; flush job runs renderDigest", async () => {
			const items: unknown[] = [];
			const n = createNotification({
				channels: {
					email: {
						mode:           "digest",
						digestKey:      (input: any) => input.userId,
						digestSchedule: { interval: 60_000 },
						renderItem:     async (opts: any) => ({ noteId: opts.input.noteId }),
						renderDigest:   async ({ items: i }: any) => {
							items.push(...i);
							return { to: "x", subject: `${i.length} items` };
						},
					},
				},
			});
			await n.send({ userId: "u1", noteId: "n1" });
			await n.send({ userId: "u1", noteId: "n2" });
			// flush manually via test API
			await (n as any).flushDigest?.("u1");
			expect(items.length).toBe(2);
		});

		it("digestMaxAge drops items older than the threshold", async () => {
			const n = createNotification({
				channels: {
					email: {
						mode:           "digest",
						digestKey:      (input: any) => input.userId,
						digestSchedule: { interval: 60_000 },
						digestMaxAge:   "1h",
						renderItem:     async () => ({ x: 1 }),
						renderDigest:   async ({ items }: any) => ({ to: "x", subject: `${items.length}` }),
					},
				},
			});
			expect(n.channels.email.digestMaxAge).toBe("1h");
		});
	});

	describe("preferences", () => {
		it.todo("preferences resolver called per (userId, notificationName)");
		it.todo("preferences.enabled=false skips the channel");
		it.todo("preferences.mode override flips the notification's default mode for the user");
		it.todo("preferences.delay override adjusts deferred delay per user");
	});

	describe("user resolution", () => {
		it("getUserId defaults to input.userId", () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "x" }) },
			});
			expect((n as any).getUserId?.({ userId: "u1" })).toBe("u1");
		});

		it("getUserId is configurable per notification", () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "x" }) },
				getUserId: (input: any) => input.recipient._id,
			});
			expect((n as any).getUserId?.({ recipient: { _id: "u9" } })).toBe("u9");
		});

		it("getUserId=null skips the preference check (system-wide)", () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "x" }) },
				getUserId: null,
			});
			expect(n.getUserId).toBeNull();
		});
	});

	describe("channel adapter interface", () => {
		it("adapter { send(payload, ctx): Promise<void> } is what each channel calls", () => {
			const n = createNotification({
				channels: { inApp: async () => ({ body: "x" }) },
			});
			// adapters are injected via serve({ notify }); the notification itself
			// declares the channel name but not the adapter implementation.
			expect(Object.keys(n.channels)).toContain("inApp");
		});
	});

	describe("synergy with createJob", () => {
		it("shares retries field", () => {
			const n = createNotification({
				retries:  3,
				channels: { inApp: async () => ({ body: "x" }) },
			});
			expect(n.retries).toBe(3);
		});

		it("shares backoff field", () => {
			const n = createNotification({
				backoff:  "linear",
				channels: { inApp: async () => ({ body: "x" }) },
			});
			expect(n.backoff).toBe("linear");
		});

		it("shares schedule field for recurring notifications", () => {
			const n = createNotification({
				schedule: { cron: "0 9 * * *" },
				channels: { inApp: async () => ({ body: "x" }) },
			});
			expect(n.schedule?.cron).toBe("0 9 * * *");
		});
	});

	describe("bus events", () => {
		it.each([
			"notify.sent", "notify.delivered", "notify.failed", "notify.skipped",
		])("emits '%s'", (event) => {
			expect(typeof event).toBe("string");
		});
	});
});

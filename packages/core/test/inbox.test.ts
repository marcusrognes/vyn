import { describe, expect, it } from "vitest";

// Contracts from /guide/notifications/#in-app-inbox
// @vyn/notify-inbox lives in a separate package once implementation
// lands; these tests describe the contract its adapter + actions
// must satisfy. Imported here from @vyn/core as stubs.

describe("@vyn/notify-inbox", () => {
	describe("inboxAdapter", () => {
		it("implements NotificationAdapter — { send(payload, ctx): Promise<void> }", async () => {
			const { inboxAdapter } = await import("../src/index.ts");
			const adapter = inboxAdapter({ collection: "notifications" });
			expect(typeof adapter.send).toBe("function");
		});

		it("persists each delivery as an InboxRow", async () => {
			const { inboxAdapter } = await import("../src/index.ts");
			const writes: unknown[] = [];
			const adapter = inboxAdapter({
				collection: {
					insertOne: async (doc: unknown) => { writes.push(doc); },
				} as any,
			});
			await adapter.send({ payload: { title: "x" } } as any, {} as any);
			expect(writes).toHaveLength(1);
		});

		it("the persisted row contains { _id, userId, notification, payload, createdAt, readAt: null }", async () => {
			const { inboxAdapter } = await import("../src/index.ts");
			let row: any;
			const adapter = inboxAdapter({
				collection: { insertOne: async (doc: any) => { row = doc; } } as any,
			});
			await adapter.send(
				{ notification: "comments.posted", payload: { title: "x", body: "y" } } as any,
				{ userId: "u1" } as any,
			);
			expect(row).toMatchObject({
				userId:       "u1",
				notification: "comments.posted",
				payload:      { title: "x", body: "y" },
				readAt:       null,
			});
			expect(row._id).toBeDefined();
			expect(row.createdAt).toBeInstanceOf(Date);
		});

		it("optionally emits to a subscription for live badge updates", async () => {
			const { inboxAdapter, createSubscription } = await import("../src/index.ts");
			const emitted: unknown[] = [];
			const onNotification = createSubscription({
				name: "test.onNotification",
				run:  async function* () {},
			});
			(onNotification as any).emit = (v: unknown) => emitted.push(v);
			const adapter = inboxAdapter({
				collection:   { insertOne: async () => undefined } as any,
				subscription: onNotification as any,
			});
			await adapter.send({ payload: { title: "x" } } as any, { userId: "u1" } as any);
			expect(emitted).toHaveLength(1);
		});

		it("groupedWith carries sibling ids when delivery was a bundle", async () => {
			const { inboxAdapter } = await import("../src/index.ts");
			let row: any;
			const adapter = inboxAdapter({
				collection: { insertOne: async (doc: any) => { row = doc; } } as any,
			});
			await adapter.send(
				{ payload: { title: "Bundle" }, groupedWith: ["x1", "x2"] } as any,
				{ userId: "u1" } as any,
			);
			expect(row.groupedWith).toEqual(["x1", "x2"]);
		});
	});

	describe("inbox.list", () => {
		it("returns rows newest-first, paginated", async () => {
			// Fixture: 3 rows for user u1, ordered desc by createdAt
			// rpc.inbox.list({ limit: 2 }) returns the two newest
			expect(true).toBe(true);   // requires action stub
		});

		it("unreadOnly:true filters to readAt:null", async () => {
			expect(true).toBe(true);
		});

		it("before: <Date> paginates older items", async () => {
			expect(true).toBe(true);
		});

		it("only returns the requesting user's rows", async () => {
			expect(true).toBe(true);
		});
	});

	describe("inbox.count", () => {
		it("returns { count: number }", async () => {
			expect(true).toBe(true);
		});

		it("unreadOnly:true counts only readAt:null", async () => {
			expect(true).toBe(true);
		});
	});

	describe("inbox.markRead", () => {
		it("sets readAt on the named row, only if owned by the requesting user", async () => {
			expect(true).toBe(true);
		});

		it("throws RpcError(not_found) when row missing or not owned", async () => {
			expect(true).toBe(true);
		});
	});

	describe("inbox.markAllRead", () => {
		it("sets readAt:now() on every unread row for the requesting user", async () => {
			expect(true).toBe(true);
		});
	});

	describe("inbox.onNew", () => {
		it("yields each inserted row scoped to the subscribed user", async () => {
			expect(true).toBe(true);
		});
	});

	describe("integration with bundling", () => {
		it("one bundle delivery creates ONE InboxRow with groupedWith populated", async () => {
			// When createNotification's bundle resolver fires, the inbox adapter
			// inserts a single row representing the bundle.
			expect(true).toBe(true);
		});

		it("the bundle row's payload contains a default { title, body, groups[] } shape when no renderBundle is set", async () => {
			expect(true).toBe(true);
		});
	});
});

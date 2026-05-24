import { beforeEach, describe, expect, it } from "vyn:test";
import { inboxAdapter, type InboxRow, type InboxStore } from "./inbox.ts";

function memStore(): InboxStore & { _rows: InboxRow[] } {
	const rows: InboxRow[] = [];
	return {
		_rows: rows,
		async insertOne(row) {
			rows.push(row);
			return row;
		},
		async find(filter) {
			return rows.filter((r) =>
				r.userId === filter.userId &&
				(filter.readAt === undefined ||
					(filter.readAt === null ? r.readAt === null : r.readAt !== null))
			);
		},
		async countDocuments(filter) {
			return rows.filter((r) =>
				r.userId === filter.userId &&
				(filter.readAt === undefined ||
					(filter.readAt === null ? r.readAt === null : r.readAt !== null))
			).length;
		},
		async updateOne(filter, patch) {
			const row = rows.find((r) => r._id === filter._id && r.userId === filter.userId);
			if (row) row.readAt = patch.$set.readAt;
		},
		async updateMany(filter, patch) {
			rows.filter((r) => r.userId === filter.userId && r.readAt === null)
				.forEach((r) => {
					r.readAt = patch.$set.readAt;
				});
		},
	};
}

describe("@vynjs/notify-inbox", () => {
	it("send persists a row with default fields", async () => {
		const store = memStore();
		const adapter = inboxAdapter({ collection: store });
		await adapter.send({ notification: "x.y", payload: { title: "T" } }, {
			userId: "u1",
		});
		expect(store._rows).toHaveLength(1);
		expect(store._rows[0]).toMatchObject({
			userId: "u1",
			notification: "x.y",
			payload: { title: "T" },
			readAt: null,
		});
		expect(store._rows[0].createdAt).toBeInstanceOf(Date);
	});

	it("groupedWith is persisted when present in the payload", async () => {
		const store = memStore();
		const adapter = inboxAdapter({ collection: store });
		await adapter.send({
			notification: "x",
			groupedWith: ["a", "b"],
			payload: {},
		}, { userId: "u1" });
		expect(store._rows[0].groupedWith).toEqual(["a", "b"]);
	});
});

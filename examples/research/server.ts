import { serve } from "@vyn/server";
import { inboxAdapter, type InboxRow } from "@vyn/notify-inbox";
import { transformer } from "./transform.ts";
import "./_vyn.gen.ts";
import { onNotification } from "./features/agent/deep-research.actions.ts";
import type { Note, ResearchRun } from "./ctx.ts";

// Tiny in-memory inbox store. Swap to MongoDB / SQLite in production.
const inboxRows: InboxRow[] = [];
const inbox = {
	insertOne: async (row: InboxRow) => { inboxRows.push(row); },
	find:      (filter: { userId: string; readAt?: null }) =>
		inboxRows.filter((r) =>
			r.userId === filter.userId &&
			(filter.readAt === undefined || (filter.readAt === null ? r.readAt === null : r.readAt !== null))),
	countDocuments: (filter: { userId: string; readAt?: null }) =>
		inboxRows.filter((r) =>
			r.userId === filter.userId &&
			(filter.readAt === undefined || (filter.readAt === null ? r.readAt === null : r.readAt !== null))).length,
	updateOne: (filter: { _id: string; userId: string }, patch: { $set: { readAt: Date } }) => {
		const row = inboxRows.find((r) => r._id === filter._id && r.userId === filter.userId);
		if (row) row.readAt = patch.$set.readAt;
	},
	updateMany: (filter: { userId: string; readAt: null }, patch: { $set: { readAt: Date } }) => {
		inboxRows.filter((r) => r.userId === filter.userId && r.readAt === null).forEach((r) => { r.readAt = patch.$set.readAt; });
	},
};

serve({
	port: Number(process.env.PORT ?? 8000),
	transformer,
	staticContext: async () => ({
		notes:    new Map<string, Note>(),
		research: new Map<string, ResearchRun>(),
		inbox,
	}),
	createContext: async () => ({ userId: "anon" }),
	notify: {
		adapters: {
			inApp: inboxAdapter({ collection: inbox, subscription: onNotification as any }),
		},
	},
	mcp: true,
});

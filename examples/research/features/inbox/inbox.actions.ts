// Inbox actions — copied into this app from the docs recipe.
// They expect the inbox adapter to be installed under `ctx.inbox`.

import { createQuery, createMutation, createSubscription, v, RpcError } from "@vynjs/core";
import type { InboxRow, InboxStore } from "./inbox.ts";

type InboxCtx = { userId: string | null; inbox: InboxStore };

const InboxRowSchema = v.object({
	_id:          v.string(),
	userId:       v.string(),
	notification: v.string(),
	payload:      v.any(),
	createdAt:    v.date(),
	readAt:       v.date().nullable(),
}) as any;

function requireUser(opts: { ctx: InboxCtx }): string {
	if (!opts.ctx.userId) throw new RpcError("unauthorized", "sign in");
	return opts.ctx.userId;
}

export const list =createQuery({
	name:        "inbox.list",
	description: "List the current user's inbox rows, newest first.",
	input:       v.object({
		unreadOnly: v.boolean().default(false),
		limit:      v.number().min(1).max(100).default(20),
	}),
	output:      v.array(InboxRowSchema),
	run: async (opts: { input: { unreadOnly: boolean; limit: number }; ctx: InboxCtx }) => {
		const userId = requireUser(opts);
		const filter: { userId: string; readAt?: null } = { userId };
		if (opts.input.unreadOnly) filter.readAt = null;
		const rows = (await opts.ctx.inbox.find?.(filter as any)) ?? [];
		return [...rows]
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
			.slice(0, opts.input.limit);
	},
});

export const count =createQuery({
	name:        "inbox.count",
	description: "Count the current user's inbox rows.",
	input:       v.object({ unreadOnly: v.boolean().default(false) }),
	output:      v.object({ count: v.number() }),
	run: async (opts: { input: { unreadOnly: boolean }; ctx: InboxCtx }) => {
		const userId = requireUser(opts);
		const filter: { userId: string; readAt?: null } = { userId };
		if (opts.input.unreadOnly) filter.readAt = null;
		const n = (await opts.ctx.inbox.countDocuments?.(filter as any)) ?? 0;
		return { count: n };
	},
});

export const markRead =createMutation({
	name:        "inbox.markRead",
	description: "Mark an inbox row as read.",
	input:       v.object({ _id: v.string() }),
	run: async (opts: { input: { _id: string }; ctx: InboxCtx }) => {
		const userId = requireUser(opts);
		await opts.ctx.inbox.updateOne?.(
			{ _id: opts.input._id, userId },
			{ $set: { readAt: new Date() } },
		);
	},
});

export const markAllRead = createMutation({
	name:        "inbox.markAllRead",
	description: "Mark every unread row for the current user as read.",
	input:       v.object({}),
	run: async (opts: { input: {}; ctx: InboxCtx }) => {
		const userId = requireUser(opts);
		await opts.ctx.inbox.updateMany?.(
			{ userId, readAt: null },
			{ $set: { readAt: new Date() } },
		);
	},
});

export const onNew = createSubscription({
	name:        "inbox.onNew",
	description: "Stream new inbox rows for the current user.",
	input:       v.object({}),
	output:      InboxRowSchema,
	run: async function* (opts) {
		const ctx = opts.ctx as InboxCtx;
		const userId = requireUser({ ctx });
		for await (const event of opts.events) {
			const row = event as InboxRow;
			if (row.userId === userId) yield row;
		}
	},
});

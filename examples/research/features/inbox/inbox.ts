// Inbox adapter — persists each delivery to a collection AND
// optionally re-emits on a subscription so connected clients see
// live updates. Recipe code: copy this file into your app's
// features/ folder and tweak to fit. See docs/guide/notifications.

import type { NotificationAdapter, SubscriptionAction } from "@vynjs/core";

export type InboxRow = {
	_id:          string;
	userId:       string;
	notification: string;
	payload:      unknown;
	createdAt:    Date;
	readAt:       Date | null;
	groupedWith?: string[];
};

export type InboxStore = {
	insertOne(row: InboxRow): Promise<unknown> | unknown;
	find?(filter: { userId: string; readAt?: null | { $ne: null } }): Promise<InboxRow[]> | InboxRow[];
	countDocuments?(filter: { userId: string; readAt?: null | { $ne: null } }): Promise<number> | number;
	updateOne?(filter: { _id: string; userId: string }, patch: { $set: { readAt: Date } }): Promise<unknown> | unknown;
	updateMany?(filter: { userId: string; readAt: null }, patch: { $set: { readAt: Date } }): Promise<unknown> | unknown;
};

export type InboxAdapterOpts = {
	collection:    InboxStore;
	subscription?: SubscriptionAction<unknown, InboxRow, unknown>;
};

export function inboxAdapter(opts: InboxAdapterOpts): NotificationAdapter & { _store: InboxStore } {
	return {
		_store: opts.collection,
		async send(payload, ctx) {
			const c = (ctx ?? {}) as { userId?: string };
			const p = (payload ?? {}) as { notification?: string; groupedWith?: string[]; payload?: unknown };
			const row: InboxRow = {
				_id:          crypto.randomUUID(),
				userId:       c.userId ?? "",
				notification: p.notification ?? "",
				payload:      p.payload ?? payload,
				createdAt:    new Date(),
				readAt:       null,
				...(p.groupedWith && { groupedWith: p.groupedWith }),
			};
			await opts.collection.insertOne(row);
			if (opts.subscription) opts.subscription.emit(row);
		},
	};
}

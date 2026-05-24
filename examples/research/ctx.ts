import type { BaseCtx } from "@vynjs/server";
import type { InboxRow } from "./features/inbox/inbox.ts";

export type Note = {
	_id: string;
	title: string;
	body: string;
	tags: string[];
	props: Map<string, unknown>;
	createdAt: Date;
};

export type ResearchRun = {
	_id: string;
	topic: string;
	jobId?: string;
	status: "queued" | "running" | "completed" | "failed";
	result?: { summary: string; citations: string[] };
	createdAt: Date;
	completedAt?: Date;
};

type InboxStoreLike = {
	insertOne(row: InboxRow): Promise<unknown> | unknown;
	find(filter: { userId: string; readAt?: null }): InboxRow[];
	countDocuments(filter: { userId: string; readAt?: null }): number;
	updateOne(
		filter: { _id: string; userId: string },
		patch: { $set: { readAt: Date } },
	): void;
	updateMany(
		filter: { userId: string; readAt: null },
		patch: { $set: { readAt: Date } },
	): void;
};

export type StaticCtx = {
	notes: Map<string, Note>;
	research: Map<string, ResearchRun>;
	inbox: InboxStoreLike;
};

export type Ctx = BaseCtx & StaticCtx;

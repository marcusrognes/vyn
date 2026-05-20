import type { BaseCtx } from "@vyn/server";

export type Note = {
	_id:       string;
	title:     string;
	body:      string;
	tags:      string[];
	props:     Map<string, unknown>;
	createdAt: Date;
};

export type ResearchRun = {
	_id:         string;
	topic:       string;
	status:      "queued" | "running" | "completed" | "failed";
	result?:     { summary: string; citations: string[] };
	createdAt:   Date;
	completedAt?: Date;
};

export type StaticCtx = {
	notes:    Map<string, Note>;
	research: Map<string, ResearchRun>;
};

export type Ctx = BaseCtx & StaticCtx;

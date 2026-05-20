import type { BaseCtx } from "@vyn/server";
import type { SessionStore } from "@vyn/auth";
import type { Note } from "./features/notes/note.ts";

export type User = { _id: string; email: string; passwordHash: string; createdAt: number };

export type StaticCtx  = {
	users:    Map<string, User>;
	notes:    Map<string, Note>;
	sessions: SessionStore;
};

export type DynamicCtx = { userId: string | null };

export type Ctx = BaseCtx & StaticCtx & DynamicCtx;

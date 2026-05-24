import { v } from "@vynjs/core";

export const NoteSchema = v.object({
	_id: v.string().uuid().default(() => crypto.randomUUID()),
	userId: v.string().uuid(),
	title: v.string().min(1).max(280).default("Untitled"),
	body: v.string().default(""),
	createdAt: v.number().default(() => Date.now()),
	updatedAt: v.number().default(() => Date.now()),
});

export type Note = ReturnType<typeof NoteSchema.parse>;

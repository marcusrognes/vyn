import { v } from "@vynjs/core";

export const TodoSchema = v.object({
	_id: v.string().uuid().default(() => crypto.randomUUID()),
	title: v.string().min(1).max(280),
	done: v.boolean().default(false),
	createdAt: v.number().default(() => Date.now()),
	updatedAt: v.number().default(() => Date.now()),
});

export type Todo = ReturnType<typeof TodoSchema.parse>;

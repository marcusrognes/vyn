import { createQuery, createMutation, createSubscription, v, RpcError } from "@vyn/core";
import { TodoSchema, type Todo } from "./todo.ts";
import type { Ctx } from "../../ctx.ts";

export const list = createQuery({
	name:        "todos.list",
	description: "Return every todo, newest first.",
	input:       v.object({}),
	output:      v.array(TodoSchema),
	run: async (opts: { input: {}; ctx: Ctx }) =>
		[...opts.ctx.todos.values()].sort((a, b) => b.createdAt - a.createdAt),
});

export const onChanged = createSubscription({
	name:        "todos.onChanged",
	description: "Stream every todo change as it happens.",
	input:       v.object({}),
	output:      v.object({
		kind: v.string(),
		todo: TodoSchema,
	}),
	run: async function* (opts) {
		for await (const event of opts.events) yield event as { kind: string; todo: Todo };
	},
});

export const add = createMutation({
	name:        "todos.add",
	description: "Add a todo.",
	input:       v.object({ title: v.string().min(1).max(280) }),
	output:      TodoSchema,
	tool:        {},
	run: async (opts: { input: { title: string }; ctx: Ctx }) => {
		const todo = TodoSchema.create(opts.input);
		opts.ctx.todos.set(todo._id, todo);
		onChanged.emit({ kind: "added", todo });
		return todo;
	},
});

export const toggle = createMutation({
	name:        "todos.toggle",
	description: "Flip the `done` flag on a todo.",
	input:       v.object({ _id: v.string().uuid() }),
	output:      TodoSchema,
	tool:        {},
	run: async (opts: { input: { _id: string }; ctx: Ctx }) => {
		const existing = opts.ctx.todos.get(opts.input._id);
		if (!existing) throw new RpcError("not_found", "todo not found");
		const updated = { ...existing, done: !existing.done, updatedAt: Date.now() };
		opts.ctx.todos.set(updated._id, updated);
		onChanged.emit({ kind: "toggled", todo: updated });
		return updated;
	},
});

export const remove = createMutation({
	name:        "todos.remove",
	description: "Delete a todo.",
	input:       v.object({ _id: v.string().uuid() }),
	tool:        {},
	run: async (opts: { input: { _id: string }; ctx: Ctx }) => {
		const existing = opts.ctx.todos.get(opts.input._id);
		if (!existing) throw new RpcError("not_found", "todo not found");
		opts.ctx.todos.delete(opts.input._id);
		onChanged.emit({ kind: "removed", todo: existing });
	},
});

import { createMutation, createQuery, createSubscription, RpcError, v } from "@vynjs/core";

type Todo = { id: string; title: string; done: boolean };

// In-memory store. Vyn is bring-your-own-db; swap this for SQLite,
// Postgres, Mongo, or anything else with a few extra lines.
const todos: Todo[] = [
	{ id: "1", title: "Setup vyn", done: true },
	{ id: "2", title: "Read the docs at https://rognes.guru/vyn", done: false },
	{ id: "3", title: "Finish the amazing idea", done: false },
];

const TodoSchema = v.object({
	id: v.string(),
	title: v.string(),
	done: v.boolean(),
});

export const list = createQuery({
	description: "List every todo.",
	input: v.object({}),
	output: v.array(TodoSchema),
	run: async () => todos,
});

export const add = createMutation({
	description: "Add a todo.",
	input: v.object({ title: v.string().min(1) }),
	output: TodoSchema,
	run: async ({ input }) => {
		const todo: Todo = {
			id: crypto.randomUUID(),
			title: input.title,
			done: false,
		};
		todos.push(todo);
		watch.emit(todo);
		return todo;
	},
});

export const toggle = createMutation({
	description: "Flip the done state of a todo.",
	input: v.object({ id: v.string() }),
	output: TodoSchema,
	run: async ({ input }) => {
		const t = todos.find((x) => x.id === input.id);
		if (!t) throw new RpcError("not_found", `no todo with id ${input.id}`);
		t.done = !t.done;
		watch.emit(t);
		return t;
	},
});

export const remove = createMutation({
	description: "Delete a todo.",
	input: v.object({ id: v.string() }),
	output: v.object({ ok: v.boolean() }),
	run: async ({ input }) => {
		const i = todos.findIndex((x) => x.id === input.id);
		if (i < 0) throw new RpcError("not_found", `no todo with id ${input.id}`);
		const [t] = todos.splice(i, 1);
		watch.emit({ ...t, _removed: true } as unknown as Todo);
		return { ok: true };
	},
});

// Stream of changes. The client subscribes once and re-renders the
// list whenever anything mutates.
export const watch = createSubscription({
	description: "Stream live changes to the todo list.",
	input: v.object({}),
	output: TodoSchema,
	async *run({ events }) {
		for await (const todo of events) yield todo;
	},
});

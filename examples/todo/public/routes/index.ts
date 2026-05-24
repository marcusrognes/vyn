// Browser-side route logic. Bundled on demand by @vynjs/server.
import { createApp } from "@vynjs/client";
import type { AppRouter } from "../../_vyn.gen.ts";
import type { Todo } from "../../features/todos/todo.ts";

const { rpc, cache } = createApp<AppRouter>({ baseUrl: location.origin });

const listEl = document.getElementById("list")!;
const form = document.getElementById("add") as HTMLFormElement;

function paint(todos: Todo[]) {
	listEl.innerHTML = "";
	for (const t of todos) {
		const li = document.createElement("li");
		if (t.done) li.classList.add("done");
		li.innerHTML = `
			<input type="checkbox" data-toggle="${t._id}" ${t.done ? "checked" : ""}>
			<label>${escape(t.title)}</label>
			<button class="btn-ghost" data-remove="${t._id}">×</button>
		`;
		listEl.appendChild(li);
	}
}

function escape(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

cache.subscribe(rpc.todos.list, paint, {});
const initial = await rpc.todos.list.query({});
cache.set(rpc.todos.list, {}, initial);

rpc.todos.onChanged.listen({}, {
	onValue(event) {
		cache.patch(rpc.todos.list, (list: Todo[]) => {
			switch (event.kind) {
				case "added":
					return [event.todo, ...list];
				case "toggled":
					return list.map((t) => t._id === event.todo._id ? event.todo : t);
				case "removed":
					return list.filter((t) => t._id !== event.todo._id);
				default:
					return list;
			}
		}, {});
	},
});

form.addEventListener("submit", async (e) => {
	e.preventDefault();
	const input = form.elements.namedItem("title") as HTMLInputElement;
	const title = input.value.trim();
	if (!title) return;
	input.value = "";
	await rpc.todos.add.mutate({ title });
});

listEl.addEventListener("click", async (e) => {
	const t = e.target as HTMLElement;
	if (t.dataset.toggle) {
		await rpc.todos.toggle.mutate({ _id: t.dataset.toggle });
	} else if (t.dataset.remove) {
		await rpc.todos.remove.mutate({ _id: t.dataset.remove });
	}
});

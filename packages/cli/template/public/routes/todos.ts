// Controller for /todos. The HTML sibling (todos.html) is the view;
// this default export is called by the router after the view mounts.
//
// `el` is the route root (#app), `params` is the matched URL params
// (none for /todos). Return a cleanup function — the router calls it
// when the user navigates away.

import { rpc } from "../app.ts";
// <todo-row> auto-registered by _vyn.client.gen.ts

type Todo = { id: string; title: string; done: boolean };

export default function mount(el: HTMLElement): () => void {
	let items: Todo[] = [];

	const listEl = el.querySelector<HTMLUListElement>("#todos")!;
	const formEl = el.querySelector<HTMLFormElement>("#new-form")!;
	const inputEl = el.querySelector<HTMLInputElement>("#new-title")!;
	const countEl = el.querySelector<HTMLSpanElement>("#count")!;

	function paint(): void {
		listEl.innerHTML = items.map((t) =>
			`<li><todo-row data-id="${attr(t.id)}" data-title="${attr(t.title)}" data-done="${t.done}"></todo-row></li>`
		).join("");
		const left = items.filter((r) => !r.done).length;
		countEl.textContent = `${left} of ${items.length} left`;
	}

	const onSubmit = async (e: Event) => {
		e.preventDefault();
		const title = inputEl.value.trim();
		if (!title) return;
		inputEl.value = "";
		try {
			await rpc.todos.add.mutate({ title });
		} catch (err) {
			inputEl.value = title;
			console.warn("[todos.add] failed:", err);
		}
	};
	formEl.addEventListener("submit", onSubmit);

	void rpc.todos.list.query({}).then((rows) => {
		items = rows;
		paint();
	});

	const unsubscribe = rpc.todos.watch.listen({}, {
		onValue: (todo: Todo & { _removed?: boolean }) => {
			if (todo._removed) {
				const i = items.findIndex((x) => x.id === todo.id);
				if (i >= 0) items.splice(i, 1);
			} else {
				const i = items.findIndex((x) => x.id === todo.id);
				if (i >= 0) items[i] = todo;
				else items.push(todo);
			}
			paint();
		},
		onError: (err) => console.warn("[todos.watch] dropped:", err),
	});

	return () => {
		unsubscribe();
		formEl.removeEventListener("submit", onSubmit);
	};
}

function attr(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

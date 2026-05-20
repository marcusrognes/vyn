// Browser-side route logic. Vanilla ES module — served as-is.
import { createApp, html, render } from "/_vyn/client.js";

const { rpc, cache } = createApp({ baseUrl: location.origin });

const listEl = document.getElementById("list");
const form   = document.getElementById("add");

function paint(todos) {
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

function escape(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Initial load + cache subscription
cache.subscribe(rpc.todos.list, paint, {});
const initial = await rpc.todos.list.query({});
cache.set(rpc.todos.list, {}, initial);

// Realtime updates
rpc.todos.onChanged.listen({}, {
	onValue(event) {
		cache.patch(rpc.todos.list, (list) => {
			switch (event.kind) {
				case "added":   return [event.todo, ...list];
				case "toggled": return list.map((t) => t._id === event.todo._id ? event.todo : t);
				case "removed": return list.filter((t) => t._id !== event.todo._id);
				default:        return list;
			}
		}, {});
	},
});

// Add a todo
form.addEventListener("submit", async (e) => {
	e.preventDefault();
	const input = form.elements.title;
	const title = input.value.trim();
	if (!title) return;
	input.value = "";
	await rpc.todos.add.mutate({ title });
});

// Toggle / remove via event delegation
listEl.addEventListener("click", async (e) => {
	const t = e.target;
	if (t.dataset.toggle) {
		await rpc.todos.toggle.mutate({ _id: t.dataset.toggle });
	} else if (t.dataset.remove) {
		await rpc.todos.remove.mutate({ _id: t.dataset.remove });
	}
});

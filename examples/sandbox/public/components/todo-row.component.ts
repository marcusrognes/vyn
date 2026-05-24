// <todo-row data-id data-title data-done>
//
// Tag is derived from this file's basename. The default export is
// the setup function — gen wires it up via defineComponent.

import { component, html, render, type Html } from "@vynjs/client";
import { rpc } from "../app.ts";

type Props = { id: string; title: string; done: boolean };

export default component<Props>((el) => {
	el.render = () => {
		el.classList.toggle("done", el.props.done);
		render(el, html`
			<label>
				<input type="checkbox" ${el.props.done ? html`checked` : ""}>
				<span>${linkify(el.props.title)}</span>
			</label>
			<button class="remove" aria-label="Remove">×</button>
		`);
	};

	el.addEventListener("change", () => { void rpc.todos.toggle.mutate({ id: el.props.id }); });
	el.addEventListener("click", (e) => {
		if ((e.target as HTMLElement).closest(".remove")) {
			void rpc.todos.remove.mutate({ id: el.props.id });
		}
	});

	el.render();
});

function linkify(text: string): Html {
	const url = /https?:\/\/\S+/g;
	const parts: (string | Html)[] = [];
	let last = 0;
	for (const m of text.matchAll(url)) {
		const i = m.index ?? 0;
		if (i > last) parts.push(text.slice(last, i));
		parts.push(html`<a href="${m[0]}" target="_blank" rel="noopener">${m[0]}</a>`);
		last = i + m[0].length;
	}
	if (last < text.length) parts.push(text.slice(last));
	return html`${parts}`;
}

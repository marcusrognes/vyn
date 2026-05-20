---
title: Components
description: File-defined custom elements. A small setup function, a render call, standard DOM events. No virtual DOM, no template engine.
sidebar:
  order: 4
---

A **component** in Vyn is a native custom element backed by a small TS
module. The framework does almost nothing — it registers the tag and
runs your setup function on connect. From there it's plain DOM:
`render(el, html\`...\`)` to write markup, `addEventListener` to handle
events, `dispatchEvent` to talk back to the parent.

Vyn does not ship a virtual DOM, JSX, or a reactive template engine.
**Re-rendering replaces the element's `innerHTML`.** That's intentional:
the implementation is tiny, the failure modes are obvious, and it's
enough for the majority of UI work. When a particular component needs
granular DOM updates (preserving focus, animating a node, driving a
canvas), it opts in by doing the work imperatively — same `el`, same
DOM API, same signals.

## File convention

A component is a single `*.component.ts` file. The framework discovers
it and registers a custom element with the **tag name derived from the
file's basename**:

```
features/notes/
├── note-card.component.ts       → <note-card>
└── auth-form.component.ts       → <auth-form>
```

The basename must contain a hyphen (the web standard for custom
elements), which usually falls out naturally from names like `note-card`
or `date-picker`.

There is no sibling `.component.html` and no two-flavor split. One
file, one setup function. If a component grows complex enough to want
a separate template file, just import it as a string and feed it to
`render()`.

## The setup function

The file default-exports `component(setup)`. The setup function runs
once per element instance, on `connectedCallback`. Receive the host
element, register a `render` method on it (or render immediately),
attach listeners, manage state — whatever the component needs.

```ts
// features/notes/note-card.component.ts
import { component, html, render } from "@vyn/client";
import type { Note } from "./note.ts";

type Props = { note: Note };

export default component<Props>((el) => {
	el.render = () => render(el, html`
		<a href="/notes/${el.props.note._id}/">
			<h3>${el.props.note.title}</h3>
			<p>${el.props.note.body.slice(0, 120)}</p>
		</a>
		<button data-action="remove">×</button>
	`);

	el.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest("button");
		if (btn?.dataset.action === "remove") {
			el.dispatchEvent(new CustomEvent("remove", { detail: el.props.note }));
		}
	});

	el.render();
});
```

What's happening:

- `component<Props>(setup)` registers the tag (from the filename) and
  installs typed `el.props` on every instance.
- The setup function attaches an `el.render()` method and any
  listeners, then calls `el.render()` once for the initial paint.
- `render(el, html\`...\`)` sets `el.innerHTML` from the `Html`
  sentinel returned by `html` — escape-by-default for interpolated
  values, nested `html\`...\`` flowing through unescaped.
- Events go through standard `addEventListener` / `dispatchEvent`.
  Inside the component, event delegation on `el` handles inner
  buttons; the component republishes intent as typed CustomEvents.

## Using a component

Mount the tag in any HTML, then drive it imperatively from the parent:

```ts
import { html, render } from "@vyn/client";
import type { Note } from "../../features/notes/note.ts";

function paint(notes: Note[]) {
	render(listEl, notes.map((n) => html`
		<note-card data-id="${n._id}"></note-card>
	`));

	for (const n of notes) {
		const el = listEl.querySelector<HTMLElement & { props: { note: Note }; render: () => void }>(
			`note-card[data-id="${n._id}"]`,
		)!;
		el.props = { note: n };
		el.render();
	}
}

listEl.addEventListener("remove", (e: Event) => {
	const detail = (e as CustomEvent<Note>).detail;
	rpc.notes.remove.mutate({ _id: detail._id });
});
```

The parent:

1. Renders one tag per item (cheap; just `innerHTML` swap).
2. Sets `el.props` directly and calls `el.render()` to paint each.
3. Listens at the container with event delegation — `<note-card>`
   dispatches `remove`, the container receives it.

This is more typing than a Lit-style `.note=${n}` binding, but it's
honest: nothing the framework does is hidden, and every line of code
has an obvious effect on the DOM.

### When the prop ergonomics hurt

For lists of items where each component needs a non-string prop, the
imperative set-then-render dance is the price. Two ways to make it
less painful:

- **Inline the HTML instead.** For simple row rendering, just use
  `html`...`` inside the parent and skip the component entirely. See
  the [Build a todo app](/tutorials/build-a-todo/) tutorial — it
  renders each row inline because the row's logic fits in five lines.
- **Reach for a `mount` helper.** A small helper that creates the
  element, sets props, and returns it — encapsulates the dance:

  ```ts
  function mountCard(parent: Element, note: Note) {
  	const el = document.createElement("note-card") as any;
  	el.props = { note };
  	parent.appendChild(el);
  	el.render();
  	return el;
  }
  ```

Pick the cost that fits the situation.

## Reactivity (when you want it)

Components are not reactive by default — setting `el.props` does not
re-render unless you call `el.render()`. That's the contract: explicit
renders, no surprises.

For components that genuinely need reactive re-renders (a counter, a
form input mirroring a signal), use the framework's signals primitive:

```ts
import { component, signal, html, render } from "@vyn/client";

export default component<{}>((el) => {
	const open = signal(false);

	function paint() {
		render(el, html`
			<details ${open() ? "open" : ""}>
				<summary>Click</summary>
				<p>Hidden until clicked.</p>
			</details>
		`);
	}

	el.addEventListener("click", (e) => {
		if ((e.target as HTMLElement).tagName === "SUMMARY") {
			open.set(!open());
		}
	});

	open.subscribe(paint);   // re-paint on change
	paint();                  // initial
});
```

Signals are tiny, synchronous, and the same primitive every other
layer of Vyn uses. They are not the framework's responsibility to
inject — you reach for them when you want them.

## Granular updates (the opt-out)

`render(el, html\`...\`)` replaces `el.innerHTML`. For most UI work
that's fine — the work is cheap and the source of truth is your data,
not the DOM. When a component needs finer control:

- **Preserve focus across renders.** Read `document.activeElement`
  before render, restore after.
- **Animate a node out before removing.** Don't re-render the parent;
  call `node.animate(...)` then remove the element directly.
- **Drive a canvas.** Render the canvas element once; mutate it via
  the `CanvasRenderingContext2D` API afterwards. Never call
  `el.render()` again.
- **Patch one field of a row.** Skip `render()`, walk to the child
  element with `$within(el, ".title")`, set `.textContent`.

Vyn does not stand in the way. The component owns `el` and can do
anything the DOM allows.

## Lifecycle

The setup function runs on `connectedCallback`. For cleanup on
`disconnectedCallback`, register on the `el.onDisconnect` helper:

```ts
export default component<{}>((el) => {
	const tick = setInterval(() => /* ... */, 1000);
	el.onDisconnect(() => clearInterval(tick));
});
```

Signal subscriptions registered via `signal.subscribe(fn)` clean up
automatically when the element disconnects. Other resources
(intervals, MutationObservers, server-sent event sources) need
explicit cleanup.

There is no `beforeUpdate` / `updated` hook tree. You call
`el.render()` when you want a render. The framework runs your setup
when the element connects and your cleanup when it disconnects.
That's the whole lifecycle.

## Props are read-only from inside

`el.props` is set by the parent. A component never writes back to its
own `el.props`. To request a change, dispatch an event; the parent
decides whether to update. This is the same shape as
`<input value="..."/>` plus an `input` event — Vyn just borrows it.

For component-local mutable state, use a `signal()` inside the setup
function. The signal is private to the component instance; the parent
never sees it.

## When to make a component

If you find yourself writing the same `html\`<li>…</li>\`` block from
two different routes, that's the moment to extract a component. Until
then, inline.

Components add an indirection (parent imports the tag, sets props,
listens for events; child renders, dispatches events) that pays off
when the markup or behavior is genuinely reusable. For one-shot
patterns inside a single route, inline HTML is honest and short.

## See also

- [Actions](/guide/actions/) — components don't call actions directly;
  they emit events for the route module to dispatch
- [Realtime](/guide/realtime/) — components react to props changing,
  not to subscriptions; the route owns the subscription
- [Build a todo app](/tutorials/build-a-todo/) — the tutorial renders
  todo rows inline, no component needed for a single-route app

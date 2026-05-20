---
title: Components
description: File-defined custom elements with two flavors — simple render functions or imperative templates + behavior.
sidebar:
  order: 4
---

A **component** in Vyn is a native custom element backed by either a
render function or an HTML template plus a behavior module. Drop a
file (or a pair) into a feature folder, and the framework registers a
HTML tag you can use anywhere.

Vyn does not ship a virtual DOM, JSX, or a runtime template language.
Components are TypeScript and HTML, sitting in plain files, registered
as custom elements at boot.

## Two flavors

Pick the flavor that matches the component:

| Flavor | Files | When to use |
|---|---|---|
| **Render-function** | `<name>.component.ts` only | Simple components whose output is mostly a function of props. The function returns a template; the framework re-renders efficiently when any read prop changes. |
| **Imperative** | `<name>.component.html` + `<name>.component.ts` | Complex components that need imperative DOM, canvas, third-party widgets, or selective updates. The HTML file is the initial DOM; the TS module wires up reactivity with `el.effect(...)`. |

The framework picks the flavor by looking at the file shape — if a
sibling `.component.html` exists, it's imperative; otherwise it's
render-function. **The tag name is the basename of the file** —
`todo-item.component.ts` becomes `<todo-item>`. The basename must
contain a hyphen (the web standard for custom elements).

## Render-function flavor

For straightforward components — a row, a card, a badge, a button
group — write a single `.component.ts` whose default export returns a
template. The framework re-renders that template whenever any prop the
template reads changes.

```ts
// features/todos/todo-item.component.ts
import { component, html } from "@vyn/client";
import type { Todo } from "./todo.ts";

export default component<{ todo: Todo }>(({ todo, emit }) => html`
	<li class="${todo.done ? "done" : ""}">
		<button @click=${() => emit("toggle", todo)}>${todo.done ? "☑" : "☐"}</button>
		<span>${todo.title}</span>
		<button @click=${() => emit("remove", todo)} style="margin-left:auto">×</button>
	</li>
`);
```

That's the whole component. No HTML file, no `el.effect`, no manual
queries. Things to notice:

- **The function receives `(props, ctx)`** in the long form; the short
  form above destructures both into one parameter. Props live alongside
  framework helpers like `emit`.
- **Returning an `html` template** is what puts the component in
  render-function mode.
- **`emit(name, detail)`** dispatches a `CustomEvent` from the host
  element. The parent listens with `@name=${handler}`.
- **Reads in the template auto-subscribe.** When the parent rebinds
  `.todo=${newTodo}`, the template re-runs and the framework patches
  only the changed bits. There is no full innerHTML replacement.

The full destructure for completeness:

```ts
component<{ todo: Todo }>((props, { emit, el }) => html`…`);
```

`props` exposes the typed prop values as signal readers (see
[Props are signal readers](#props-are-signal-readers) below); reading
them inside the returned template tracks them automatically. `ctx`
exposes `emit`, the host `el`, `effect`, and `onDisconnect` for the
rare case you need them in render-function mode.

## Imperative flavor

For components that need imperative DOM control — animations, canvas,
third-party widgets, selective updates skipping the diff — pair an
HTML template with a TS behavior module.

```html
<!-- features/todos/todo-item.component.html -->
<li>
	<button data-action="toggle"></button>
	<span class="title"></span>
	<button data-action="remove" style="margin-left:auto">×</button>
</li>
```

```ts
// features/todos/todo-item.component.ts
import { component, $within } from "@vyn/client";
import type { Todo } from "./todo.ts";

export default component<{ todo: Todo }>((props, { el, emit }) => {
	const titleEl  = $within(el, ".title");
	const toggleEl = $within<HTMLButtonElement>(el, "[data-action=toggle]");
	const removeEl = $within<HTMLButtonElement>(el, "[data-action=remove]");

	el.effect(() => {
		const t = props.todo();
		el.classList.toggle("done", t.done);
		titleEl.textContent = t.title;
		toggleEl.textContent = t.done ? "☑" : "☐";
	});

	toggleEl.addEventListener("click", () => emit("toggle", props.todo()));
	removeEl.addEventListener("click", () => emit("remove", props.todo()));
});
```

What changes from render-function mode:

- The function returns nothing. The framework sees `void` and stays in
  imperative mode.
- The initial DOM comes from the `.component.html` file. Vyn injects
  it before the function runs.
- `el.effect(fn)` is a reactive effect: any prop read inside it
  re-runs `fn` when that prop changes. Multiple effects can target
  different parts of the DOM, so a single prop change only touches the
  pieces that actually depend on it.
- Event wiring is by `addEventListener`, not `@event` template binding.

Use this flavor when you need updates the renderer wouldn't make on
its own — keeping focus during a re-render, preserving a video element
across prop changes, talking to a Web Component that has internal
state.

## Using a component

Once registered, you use the tag like any other HTML element. To pass
typed props or attach event handlers, use the `@vyn/client` `html`
helper with two prefix conventions borrowed from the custom-elements
ecosystem:

- `.prop=${value}` sets a **JavaScript property** on the element.
- `@event=${handler}` adds an **event listener**.

Bare `attr=${value}` still sets an HTML attribute as a string.

```ts
import { render, html } from "@vyn/client";

render(listEl, todos.map(t => html`
	<todo-item
		.todo=${t}
		@toggle=${e => rpc.todos.toggle.mutate({ _id: e.detail._id })}
		@remove=${e => rpc.todos.remove.mutate({ _id: e.detail._id })}
	></todo-item>
`));
```

There is no compilation step. The same `html` tag is used for the
component's returned template *and* for parent-side composition.

## Props are signal readers

Whichever flavor you use, the type you pass to `component<T>` describes
the **value** shape of each prop. Inside the component, the framework
wraps every prop as a **signal reader** so reads can be tracked
automatically:

```ts
component<{ todo: Todo }>((props) => {
	// props.todo is () => Todo, not Todo directly

	const t: Todo = props.todo();          // read the current value
	// Reads inside an effect or returned template auto-subscribe.
});
```

In **render-function mode**, you usually destructure into a plain
value: `({ todo, emit }) => html`…`` — the destructure preserves
reactivity because the destructure happens inside the function the
framework re-runs.

In **imperative mode**, you read through the signal: `props.todo()`
inside an `el.effect(...)`.

Two consequences worth knowing in both flavors:

1. **Props are read-only.** There is no `props.todo.set(...)`. A child
   never writes back to its parent's value. Surface changes through
   custom events instead; the parent decides whether to update.
2. **Reads track.** Reading inside `el.effect(fn)` or inside a returned
   template subscribes that effect (or template) to the prop. Reading
   outside both fires once on connect and never reacts.

## Slots

Components participate in standard slotted composition. Use `<slot>`
in the template:

```html
<!-- features/ui/card.component.html (imperative flavor) -->
<section class="card">
	<header><slot name="header"></slot></header>
	<div class="body"><slot></slot></div>
</section>
```

Render-function flavor uses the same:

```ts
export default component<{}>(() => html`
	<section class="card">
		<header><slot name="header"></slot></header>
		<div class="body"><slot></slot></div>
	</section>
`);
```

```ts
render(host, html`
	<x-card>
		<h2 slot="header">Hello</h2>
		<p>This text lands in the default slot.</p>
	</x-card>
`);
```

Slots are useful when a component owns the layout and the parent
controls the content. For more typed composition, prefer props.

## Local state

For component-local state, import `signal` from `@vyn/client`. Works
the same in both flavors:

```ts
import { component, signal, html } from "@vyn/client";

export default component<{}>(() => {
	const open = signal(false);
	return html`
		<details ?open=${open()}>
			<summary @click=${() => open.set(!open())}>Click</summary>
			<p>Hidden until clicked.</p>
		</details>
	`;
});
```

Signals are the same primitive across the framework — actions, route
modules, and components all read and write the same kind of value.
They are tiny, synchronous, and you can `console.log` what's in them.

## Lifecycle

The component function runs once per element on `connectedCallback`.
For one-off work that needs cleanup (subscriptions, intervals), use
`onDisconnect(fn)` from the ctx:

```ts
export default component<{}>((_, { onDisconnect }) => {
	const tick = setInterval(() => { /* ... */ }, 1000);
	onDisconnect(() => clearInterval(tick));
});
```

There is no `mounted` / `beforeUpdate` / `unmounted` hook tree. The
function body is "mounted" and `onDisconnect` is "unmounted." Effects
and template-tracking clean up automatically.

## When to make a component

If you find yourself writing the same `html\`<li>…</li>\`` block from
two different routes, that's the moment to extract a component. Until
then, inline. Components add one indirection: parent passes props,
child reads them, child emits events, parent handles them. Worth it
when reuse pays for the dance; premature otherwise.

When you do extract, start with the render-function flavor. Most
components stay there. Switch to the imperative flavor only when the
component genuinely needs DOM control the renderer wouldn't give it.

## See also

- [Actions](/guide/actions/) — components don't call actions directly;
  they emit events for the route module to dispatch
- [Realtime](/guide/realtime/) — components react to props changing,
  not to subscriptions; the route owns the subscription
- [Build a todo app](/tutorials/build-a-todo/) — the tutorial uses a
  render-function `<todo-item>` component end-to-end

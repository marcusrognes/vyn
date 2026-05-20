---
title: Native platform
description: Vyn's first move is always to lean on what the browser ships. This page lists the native HTML, CSS, and JS features Vyn assumes; if one of these covers your case, skip the behavior or widget.
sidebar:
  order: 9
---

Vyn aims to be small. One way it stays small is by leaning on the
platform: most things a UI needs are now built into HTML, CSS, or
JavaScript, and the framework's job is to glue between them — not to
re-implement them.

This page lists the platform features Vyn assumes are available in
every supported browser. When one of these covers your case, **use
the native feature** and skip the corresponding behavior or widget
entirely. The behaviors and widgets in `@vyn/ui` are the polyfill
layer and the composition layer — they're not always the answer.

Supported browsers for this list: recent Chrome, Edge, Firefox, and
Safari. Each section calls out when a feature requires a current
version (vs older releases) — features that ship in only one engine
are not on this list.

## Floating UI

### CSS Anchor Positioning

Position a floating element relative to another in pure CSS — no JS
positioning loop, no listener on scroll/resize.

```css
.trigger { anchor-name: --my-trigger; }
.popover {
	position-anchor: --my-trigger;
	top: anchor(bottom);
	left: anchor(start);
	position: fixed;
	position-try-fallbacks: flip-block, flip-inline;
}
```

The fallback list lets the engine flip to the opposite side when
there's no room. Pair with the native popover attribute and you
have a complete anchored popover with no JavaScript.

[`@vyn/ui/anchor`](/ui/anchor/) leads with this CSS-first approach
and falls back to JS positioning where needed.

### Popover API

`popover` attribute + `popovertarget` button. Browser handles top-layer
rendering, Esc dismissal, outside-click dismissal, focus restoration.

```html
<button popovertarget="filters">Filters</button>
<div id="filters" popover>
	<form>…</form>
</div>
```

No JS. No `<v-popover>`. No `@vyn/ui/popover` for the common case.

Use [`@vyn/ui/popover`](/ui/popover/) when you need anchored
positioning (the native API doesn't ship anchor positioning
universally yet) or to control state programmatically with the
`data-popover` attribute pattern.

### Modal dialogs

Native `<dialog>` + `.showModal()` traps focus inside, makes the rest
of the page `inert`, handles backdrop click, supports Esc dismissal
out of the box. Submit a form with `method="dialog"` to close with a
return value.

```html
<dialog id="confirm">
	<form method="dialog">
		<button value="cancel">Cancel</button>
		<button value="confirm">Delete</button>
	</form>
</dialog>

<button onclick="document.getElementById('confirm').showModal()">
	Delete…
</button>
```

The dialog handles focus trap. The form `method="dialog"` handles
close + return value. The browser handles all of it.

[`@vyn/ui/focus-trap`](/ui/focus-trap/) is for the rare non-dialog
case where you need to constrain Tab focus inside a region that
isn't a modal — for example, a drawer that should trap focus but
not block the rest of the page.

### `inert` attribute

Mark a subtree as non-interactive — no focus, no clicks, no
scrolling, removed from accessibility tree. Modal `<dialog>` applies
this automatically to everything outside; you can apply it manually
to siblings of a non-modal drawer.

```html
<aside id="drawer">…</aside>
<main inert>…</main>
```

When the drawer closes, remove `inert` from `<main>`. Native behavior;
no custom widget required.

## Forms

### Validation hints

Use native validation attributes; they ship with browser-localized
error messages and screen-reader support.

```html
<input type="email" required>
<input type="text" pattern="[A-Z]{2}\d{4}">
<input type="number" min="0" max="100" step="5">
```

Pair with [`@vyn/ui/aria-describedby`](/ui/aria-describedby/) for
inline error text that screen readers announce alongside the input.

### Input type hints

```html
<input type="email" autocomplete="email" enterkeyhint="send" inputmode="email">
<input type="tel" autocomplete="tel" inputmode="numeric">
<input type="search" enterkeyhint="search">
```

| Attribute | What it does |
|---|---|
| `autocomplete` | Hints the autofill category — `email`, `tel`, `current-password`, etc. Crucial for password managers and accessibility. |
| `enterkeyhint` | Labels the mobile virtual keyboard's Return button — `go`, `done`, `next`, `previous`, `search`, `send`. |
| `inputmode` | Hints the keyboard layout (`numeric`, `decimal`, `email`, `tel`, etc.) — affects what keys appear on mobile. |

Set these on every form input. Cheap; meaningful.

### Native styling

```css
:root { accent-color: dodgerblue; }
```

`accent-color` styles native checkboxes, radios, range sliders, and
progress bars in one declaration. No custom element required for
basic theming.

### Form-associated custom elements

For custom-element widgets that hold a value
([`<v-combobox>`](/ui/combobox/) for example), use the native
`formAssociated = true` + `ElementInternals` API — not Vyn's
[`form-associated`](/ui/form-associated/) behavior. The behavior is
for plain HTML containers.

```ts
class MyInput extends HTMLElement {
	static formAssociated = true;
	#internals = this.attachInternals();
	set value(v: string) { this.#internals.setFormValue(v); }
}
```

## Disclosure

### `<details>` + `<summary>`

Native disclosure widget with keyboard, ARIA, and animation hooks
built in. The `name` attribute groups multiple `<details>` into a
mutually-exclusive accordion.

```html
<details name="accordion"><summary>One</summary>…</details>
<details name="accordion"><summary>Two</summary>…</details>
<details name="accordion"><summary>Three</summary>…</details>
```

Opening one closes the others. No custom widget.

For open/close animation, use `@starting-style` and
`transition-behavior: allow-discrete` — both shipping in current
browsers. They let `transition` work across `display: none`, which
the popover attribute toggles. See [Animation](#animation) below.

## Scrolling

### `scroll-margin-top`

Set this on items inside a scroll container to control where
`scrollIntoView()` lands relative to a sticky header.

```css
[data-keyboard-nav] > * {
	scroll-margin-top: 3rem;   /* leave room for the sticky header */
}
```

Pair with [`@vyn/ui/scroll-into-view`](/ui/scroll-into-view/);
together they keep the focused item visible without overlap.

## Selection

### `<select>` + `<datalist>`

For simple, non-styled selections, use the native primitives. They
ship with full keyboard, mobile-friendly UI, autofill, and form
association.

```html
<select name="role">
	<option value="admin">Admin</option>
	<option value="editor">Editor</option>
</select>

<input list="cities" name="city">
<datalist id="cities">
	<option value="London">
	<option value="Paris">
	<option value="Tokyo">
</datalist>
```

Reach for [`<v-combobox>`](/ui/combobox/) only when the visual
design requires custom styling or async data loading that
`<datalist>` can't provide.

## Clipboard

`navigator.clipboard.writeText(string)` is universal. The
[`@vyn/ui/copy`](/ui/copy/) behavior wraps it with feedback and
announcement, but for one-off cases the native call is enough.

## CSS

### `:has()` selector

Style based on what an element contains. Eliminates JS for many
state-dependent cases.

```css
/* Hide the tooltip if the target has any descendant focused */
[data-tooltip-for]:has(:focus-within) + [data-tooltip] {
	display: none;
}

/* Style a form row when its input is invalid */
.field:has(:invalid) {
	border-color: red;
}
```

Pair with the `data-state` attributes Vyn behaviors set for full
state-driven styling without JavaScript.

### Container queries

```css
@container (min-width: 30rem) {
	.card { grid-template-columns: 1fr 1fr; }
}
```

Layout responds to the parent's size, not the viewport's. Use
inside reusable components so they adapt regardless of where they're
placed.

## Animation

### `@starting-style` + `transition-behavior: allow-discrete`

Animate elements entering and leaving the DOM (or appearing /
disappearing via `display: none`, which the popover attribute uses)
purely in CSS — no JS-driven `data-state="opening"` / `"closing"`
attributes needed.

```css
[popover] {
	opacity: 0;
	transform: translateY(-4px);
	transition: opacity 0.15s, transform 0.15s, overlay 0.15s allow-discrete,
		display 0.15s allow-discrete;
}

[popover]:popover-open {
	opacity: 1;
	transform: translateY(0);
}

@starting-style {
	[popover]:popover-open {
		opacity: 0;
		transform: translateY(-4px);
	}
}
```

Animation now works across discrete properties (`display`, `overlay`)
because of `transition-behavior: allow-discrete`. `@starting-style`
defines what the element looks like just before transitioning to its
visible state.

Vyn behaviors emit `data-state` attributes for JS-driven animation
when this isn't enough, but for popovers and dialogs the CSS-only
approach is shorter and faster.

### View Transitions API

For cross-DOM-update animations — switching routes, re-ordering a
list, swapping a card with its detail view — use the native View
Transitions API. The browser captures the current state, applies
your DOM changes, then animates between the two states via CSS.

```ts
document.startViewTransition(() => {
	// any DOM update — Vyn's render(), a route change, anything
	listEl.append(newCard);
});
```

```css
::view-transition-old(root) { animation: fade-out 0.2s; }
::view-transition-new(root) { animation: fade-in  0.2s; }

/* Animate a specific element by name */
.card { view-transition-name: card-detail; }
::view-transition-old(card-detail),
::view-transition-new(card-detail) { animation: 0.3s ease; }
```

Cross-page transitions need an `@view-transition` rule:

```css
@view-transition { navigation: auto; }
```

Vyn's router triggers `startViewTransition` automatically on route
changes when the API is available. Apps don't have to write any
extra code; just declare the CSS rules.

## Storage and APIs

### Cookie Store API

Read and write cookies programmatically with a Promise-based API
instead of parsing `document.cookie`.

```ts
const session = await cookieStore.get("session");
if (session) {
	console.log(session.value);
}

await cookieStore.set({
	name:     "session",
	value:    token,
	domain:   "example.com",
	path:     "/",
	expires:  Date.now() + TTL_MS,
	sameSite: "lax",
	secure:   true,
});

cookieStore.addEventListener("change", (e) => {
	for (const c of e.changed) console.log("set:", c.name);
	for (const c of e.deleted) console.log("removed:", c.name);
});
```

Note that Cookie Store is a **browser** API — server-side code
(the auth tutorial's `readSession`, `issueSession`) parses the
request's `Cookie` header and writes to response cookies via the
`setCookie` helper on `ctx`. Cookie Store helps when the client
needs to inspect or update its own cookies (e.g., for client-side
session refresh hints).

## What `@vyn/ui` exists for

Given everything above, what does Vyn actually contribute? Two
things:

1. **Glue for the cases the platform doesn't cover.** Anchored
   positioning, type-ahead, roving tabindex, drag-and-drop with
   keyboard fallback, inline-edit, sort UI, multi-selection state.
2. **Polyfill + ARIA glue for the cases it does.** Behaviors like
   `dismiss` and `popover` are thin wrappers that add data-attribute
   composition and ARIA wiring on top of the native API, so a single
   pattern works whether you use the native primitive or compose
   behaviors manually.

If a native feature does what you need, use it. The framework will
thank you with smaller bundles, fewer bugs, and broader compatibility.

---
title: <v-disclosure>
description: A wrapper around the native <details> element that adds animation hooks and an open-state event. Everything else is just <details>.
---

A thin wrapper around the native `<details>` and `<summary>`
elements. The platform already handles the keyboard and ARIA
correctly for disclosure widgets; `<v-disclosure>` adds two things
the platform doesn't ship:

1. CSS hooks for animating open/close (`data-state="opening"` /
   `"closing"`).
2. An `open` event you can listen to without polling.

For any case that doesn't need an animation or programmatic open-event,
**use native `<details>`** — it's already accessible and reflowable.

```html
<v-disclosure>
	<summary>Advanced settings</summary>
	<div class="content">
		<v-toggle name="experimental">Experimental features</v-toggle>
		<v-toggle name="telemetry">Send anonymous usage data</v-toggle>
	</div>
</v-disclosure>
```

```ts
import "@vyn/ui/disclosure";

document.querySelector("v-disclosure")!.addEventListener("toggle", (e) => {
	const open = (e.target as HTMLElement & { open: boolean }).open;
	// ...
});
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | A `<summary>` element followed by the content. Same shape as native `<details>` |

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `open` | boolean | `false` | Open state; reflects |
| `animate` | boolean | `true` | Enable open/close animation. Set to `false` for snap behavior |

The animation respects `prefers-reduced-motion`.

## Events

| Event | Detail | When |
|---|---|---|
| `toggle` | `{}` (read `.open` on the element) | After the open state changes |
| `open`   | `{}` | Just before opening (call `event.preventDefault()` to keep closed) |
| `close`  | `{}` | Just before closing |

`open` and `close` are interceptable — useful for "confirm before
collapsing this form" patterns.

## Keyboard

| Key | Effect |
|---|---|
| `Space`, `Enter` | Toggle open (native; same as `<details>`) |

## ARIA

The native `<details>` + `<summary>` pair already exposes the right
roles. `<v-disclosure>` doesn't add ARIA attributes.

## CSS variables and data attributes

| Variable / attribute | What it styles |
|---|---|
| `--vyn-disclosure-transition-duration` | Open/close animation duration (default `0.2s`) |
| `data-state="opening"` | Set on the element during the open transition |
| `data-state="closing"` | Set on the element during the close transition |
| `data-state="open"` | Set while fully open |
| `data-state="closed"` | Set while fully closed |

```css
v-disclosure[data-state="opening"] > :not(summary) {
	animation: slide-down var(--vyn-disclosure-transition-duration);
}
v-disclosure[data-state="closing"] > :not(summary) {
	animation: slide-up var(--vyn-disclosure-transition-duration);
}
@keyframes slide-down { from { transform: translateY(-4px); opacity: 0 } }
@keyframes slide-up   { to   { transform: translateY(-4px); opacity: 0 } }
```

## Accessibility notes

- Keyboard and screen-reader behavior is the same as native
  `<details>` — no surprises.
- Don't animate so long that users have to wait for the content to
  appear. Default is 200ms; longer than 300ms feels sluggish.

## Programmatic control

```ts
disclosure.open = true;
disclosure.toggle();
```

## See also

- [Native `<details>` MDN docs](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details) — what this wraps
- [`<v-dialog>`](/ui/dialog/) — for modal content
- [`<v-popover>`](/ui/popover/) — for floating content

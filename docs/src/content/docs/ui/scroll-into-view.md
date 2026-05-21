---
title: scroll-into-view
description: Scroll the active child of a container into view on focus, on aria-selected, or on an attribute change. One attribute on the container; the behavior watches every child.
sidebar:
  order: 19
---

`@vyn/ui/scroll-into-view` keeps the active descendant of a
container visible without you scripting `scrollIntoView()` calls.
Apply `data-scroll-into-view` on the **container**; whichever child
receives focus (or matches the watched attribute) gets scrolled
into view inside the nearest scroll parent.

```html
<ul data-keyboard-nav data-scroll-into-view>
	<li>Apple</li>
	<li>Banana</li>
	<li>Cherry</li>
	<!-- … hundreds of items, only some visible at once -->
</ul>
```

```ts
import "@vyn/ui/scroll-into-view";
import "@vyn/ui/keyboard-nav";
```

Arrow-keying through the list moves focus to each item; the
container scrolls so the focused item is visible. One attribute on
the container; the behavior handles every child.

## Attributes (on the container)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-scroll-into-view` | trigger | `"focus"` | When to scroll. `"focus"` listens for focusin on descendants; `"selected"` watches `aria-selected="true"` on descendants; `"data-active"` (or any other attribute name) watches that attribute |
| `data-scroll-items` | CSS selector | `":scope > *"` | Which descendants count as scroll targets |
| `data-scroll-block` | `"start" \| "center" \| "end" \| "nearest"` | `"nearest"` | Vertical alignment (passed to `scrollIntoView`) |
| `data-scroll-inline` | same | `"nearest"` | Horizontal alignment |
| `data-scroll-behavior` | `"smooth" \| "instant" \| "auto"` | `"auto"` | Whether to animate. `prefers-reduced-motion` forces instant |

## Examples

### Keyboard-nav list

The most common case — `keyboard-nav` moves focus, this behavior
scrolls.

```html
<ul data-keyboard-nav data-scroll-into-view data-scroll-block="center">
	<li tabindex="0">Item 1</li>
	<li tabindex="0">Item 2</li>
</ul>
```

### Selection-driven (combobox-style)

When focus stays on the input but a "virtual" focus moves via
`aria-selected`:

```html
<div data-scroll-into-view="selected" data-scroll-items="[role=option]">
	<div role="option">A</div>
	<div role="option" aria-selected="true">B</div>
	<div role="option">C</div>
</div>
```

The behavior watches each option's `aria-selected` attribute and
scrolls the currently-selected one into view.

### Custom flag

For app-specific "active" state:

```html
<ul data-scroll-into-view="data-active">
	<li>One</li>
	<li data-active="true">Two</li>
	<li>Three</li>
</ul>
```

Setting `data-active="true"` on a different `<li>` scrolls it into
view.

## Why it lives on the container

Putting the attribute on the container has two payoffs:

1. **One attribute regardless of item count** — 5 items or 50k, the
   markup is the same.
2. **Items added dynamically work without rewiring** — the behavior
   delegates from the container, so new children are covered
   automatically.

For the rare case where you need scroll-into-view on a single
standalone element (not inside a list), apply the attribute to that
element directly; the behavior falls back to "scroll this element
into view on its own focus."

## See also

- [`@vyn/ui/keyboard-nav`](/vyn/ui/keyboard-nav/) — usually paired
- Native [`scrollIntoView`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) — what this wraps

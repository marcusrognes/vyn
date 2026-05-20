---
title: scroll-into-view
description: Scroll an element into view when it receives focus, becomes selected, or its observed attribute changes.
sidebar:
  order: 19
---

`@vyn/ui/scroll-into-view` keeps the relevant element visible
without you scripting `scrollIntoView()` calls. Apply
`data-scroll-into-view` and the behavior listens for focus changes,
selection changes, or arbitrary attribute changes on the element,
and scrolls the nearest scroll parent to bring it into view.

```html
<ul data-keyboard-nav>
	<li data-scroll-into-view>Apple</li>
	<li data-scroll-into-view>Banana</li>
	<li data-scroll-into-view>Cherry</li>
	<!-- … hundreds of items, only some visible at once -->
</ul>
```

```ts
import "@vyn/ui/scroll-into-view";
import "@vyn/ui/keyboard-nav";
```

Arrow-keying through the list scrolls the focused item into view
without any JS to wire up.

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-scroll-into-view` | boolean or attribute name | `"focus"` | Trigger. `"focus"` scrolls on focus; `"selected"` watches `aria-selected="true"`; any other string is a CSS attribute name to watch |
| `data-scroll-block` | `"start" \| "center" \| "end" \| "nearest"` | `"nearest"` | Vertical alignment (passed to `scrollIntoView`) |
| `data-scroll-inline` | same | `"nearest"` | Horizontal alignment |
| `data-scroll-behavior` | `"smooth" \| "instant" \| "auto"` | `"auto"` | Whether to animate the scroll. `prefers-reduced-motion` forces instant |

## Examples

```html
<!-- Scroll into view when this item becomes the active descendant -->
<li data-scroll-into-view="aria-selected" data-scroll-block="center">…</li>

<!-- Scroll into view when this gets data-active="true" (custom flag) -->
<li data-scroll-into-view="data-active">…</li>
```

## Why this exists

Most `scrollIntoView` calls happen in keyboard-driven lists, virtual
focus patterns (combobox), and tab navigation. Factoring it out of
each widget makes the same behavior consistent everywhere.

## See also

- [`@vyn/ui/keyboard-nav`](/ui/keyboard-nav/) — usually paired
- Native [`scrollIntoView`](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) — what this wraps

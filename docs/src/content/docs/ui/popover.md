---
title: popover
description: Use the native Popover API for the common case; this behavior adds anchored positioning and data-attribute composition for richer needs.
sidebar:
  order: 7
---

For most popovers, **use the native [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)** —
it's universally supported in current browsers, and it handles
top-layer rendering, Esc dismissal, outside-click dismissal, and
focus restoration with zero JavaScript.

```html
<button popovertarget="filters">Filters</button>

<div id="filters" popover>
	<form>
		<label>Min <input type="number" name="min" /></label>
		<label>Max <input type="number" name="max" /></label>
	</form>
</div>
```

That's the whole popover. No imports, no JS, no widget. The browser
handles the rest.

The `@vyn/ui/popover` module exists for two reasons the native API
doesn't cover:

1. **Anchored positioning** — the native API renders in the top layer
   but doesn't position relative to a trigger. CSS Anchor Positioning
   ships in Chromium only as of 2026, so cross-browser anchoring
   needs JS.
2. **Composition with other behaviors** — combining popover with
   [`keyboard-nav`](/vyn/ui/keyboard-nav/), [`select`](/vyn/ui/select/),
   [`typeahead`](/vyn/ui/typeahead/) on the same element is what makes
   dropdown menus and listboxes work. The behavior reads/writes the
   open state via `data-open` so other behaviors can coordinate.

## When to use which

| Need | Use |
|---|---|
| A simple floating panel with default dismiss | Native `popover` attribute + `popovertarget` |
| Anchored to a trigger (positioning) | `@vyn/ui/popover` + [`@vyn/ui/anchor`](/vyn/ui/anchor/) |
| Composed with `keyboard-nav` / `select` / `typeahead` | `@vyn/ui/popover` |
| Modal blocking | Not a popover — use `<dialog>.showModal()` instead |

## The behavior

When you do reach for `@vyn/ui/popover`, the shape is:

```html
<button id="filters-trigger" data-popover-trigger="filters">Filters</button>

<div id="filters"
     data-popover data-anchor="filters-trigger"
     data-placement="bottom-start" data-offset="4">
	<form>…</form>
</div>
```

```ts
import "@vyn/ui/popover";
```

The behavior internally uses the native `popover` attribute where
available, then layers anchored positioning on top.

## Attributes (on the popover)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-popover` | boolean | required | Activates the behavior |
| `data-anchor` | string | unset | id of the anchor element. When set, [`anchor`](/vyn/ui/anchor/) is composed automatically |
| `data-placement` | placement | `"bottom-start"` | Position relative to anchor |
| `data-offset` | number | `4` | Pixel gap |
| `data-open` | boolean | `false` | Open state; reflected; assign to toggle |
| `data-dismiss-on` | string | `"escape outside"` | What dismisses the popover. Forwarded to [`dismiss`](/vyn/ui/dismiss/) |

## Attributes (on the trigger)

| Attribute | What it does |
|---|---|
| `data-popover-trigger` | id of the popover; sets `aria-haspopup` / `aria-expanded` / `aria-controls` and toggles the popover on click. Mirrors `popovertarget` but works with the data-attribute composition pattern |

If you'd rather use the native button attribute, set
`popovertarget="..."` instead — the behavior recognizes both.

## Events

| Event | Detail | When |
|---|---|---|
| `open`       | `{}` | Popover opened |
| `close`      | `{ reason: "outside" \| "escape" \| "focus-out" \| "programmatic" }` | Popover closed |
| `reposition` | `{ placement }` | Position recomputed |

The behavior emits the same events the native `popover` element
emits (`toggle`) plus the `reposition` event from anchored
positioning.

## ARIA

The trigger receives `aria-haspopup`, `aria-expanded`, and
`aria-controls` whether you used the native attribute or the
behavior. Apply `role="menu"`, `role="dialog"`, etc. on the popover
itself as needed.

## See also

- Native [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) — use this first
- [`@vyn/ui/anchor`](/vyn/ui/anchor/) — positioning primitive composed automatically when `data-anchor` is set
- [`@vyn/ui/dismiss`](/vyn/ui/dismiss/) — for popovers that need custom dismiss semantics
- [Native platform](/vyn/guide/native-platform/) — what the browser already ships

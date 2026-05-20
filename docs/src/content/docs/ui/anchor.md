---
title: anchor
description: Position one element relative to another. Lead with CSS Anchor Positioning; this behavior is a JS fallback for older browsers and adds data-attribute composition.
sidebar:
  order: 4
---

For most anchored positioning, **use CSS Anchor Positioning** — it
ships in current browsers and runs entirely in CSS, with no JS to
keep position synced.

```css
.trigger {
	anchor-name: --filters-trigger;
}

.popover {
	position-anchor: --filters-trigger;
	position: fixed;
	top:  anchor(bottom);
	left: anchor(start);
	margin-top: 4px;
	position-try-fallbacks: flip-block, flip-inline;
}
```

The fallback list lets the engine flip to the other side of the
anchor when there's no room. Pair with the native popover attribute
and you have a complete anchored popover with no JavaScript.

`@vyn/ui/anchor` is for cases the CSS API doesn't cover:

1. **Browsers without anchor positioning** — the behavior provides a
   JS fallback that mirrors the same flip/shift semantics.
2. **Data-attribute composition** — when you want to combine anchor
   with other behaviors using the `data-anchor` pattern instead of
   wiring CSS custom properties.

```html
<button id="info-trigger">Info ⓘ</button>

<div data-anchor="info-trigger" data-placement="right-start" data-offset="8">
	This sticks to the button.
</div>
```

```ts
import "@vyn/ui/anchor";
```

The behavior detects support for CSS Anchor Positioning at runtime
and uses it when available — falling back to JS positioning
otherwise.

## When to use which

| Need | Use |
|---|---|
| Simple anchored floating element | CSS `anchor-name` + `position-anchor` |
| Combine with `data-popover`, `data-dismiss`, etc. | `@vyn/ui/anchor` (uses CSS under the hood when available) |
| Manual positioning via `position(target, anchor)` | The exported `position()` helper from `@vyn/client` |

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-anchor` | string | required | id of the anchor element |
| `data-placement` | placement | `"bottom-start"` | Position |
| `data-offset` | number | `0` | Pixel gap from anchor |
| `data-flip` | `"true" \| "false"` | `"true"` | Flip to opposite side when no room |
| `data-shift` | `"true" \| "false"` | `"true"` | Slide along the edge when no room |

The anchor can also be set as a property (`el.anchor = element`)
for cases where there's no stable id.

## Events

| Event | Detail | When |
|---|---|---|
| `reposition` | `{ placement: string }` | Position recomputed (scroll, resize, flip) |

## Programmatic control

```ts
import { position } from "@vyn/client";

const cleanup = position(floatingEl, anchorEl, {
	placement: "right-start",
	offset:    8,
	flip:      true,
});

// later
cleanup();    // stop tracking
```

## What it sets

The element gets `position: fixed`, `top`, `left`, and a
`data-state="placement-X"` attribute reflecting the actual placement
after flip. Use the state attribute for direction-aware styling:

```css
[data-anchor][data-state="placement-top"]    { transform-origin: bottom }
[data-anchor][data-state="placement-bottom"] { transform-origin: top }
```

## See also

- Native [CSS Anchor Positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning) — use this first
- [`@vyn/ui/popover`](/ui/popover/) — anchor + open/close + dismiss
- [`@vyn/ui/tooltip`](/ui/tooltip/) — anchor + dismiss + describedby + hover/focus
- [Native platform](/guide/native-platform/) — what the browser ships

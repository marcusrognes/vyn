---
title: anchor
description: Position one element relative to another with flip-to-fit, offset, and resize tracking. The positioning primitive popovers and tooltips compose.
sidebar:
  order: 4
---

`@vyn/ui/anchor` positions one element relative to another — the
floating-UI primitive behind popovers, tooltips, and dropdowns.
Apply `data-anchor="trigger-id"` and `data-placement="bottom-start"`
on the floating element; it sticks to its anchor through scroll,
resize, and parent overflow.

This is mostly used internally by other behaviors. Reach for it
directly when you want positioning without the open/close + dismiss
semantics [`popover`](/ui/popover/) adds.

```html
<button id="info-trigger">Info ⓘ</button>

<div data-anchor="info-trigger" data-placement="right-start" data-offset="8">
	This sticks to the button.
</div>
```

```ts
import "@vyn/ui/anchor";
```

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-anchor` | string | required | id of the anchor element |
| `data-placement` | `"top" \| "bottom" \| "left" \| "right" \| "top-start" \| "top-end" \| "bottom-start" \| "bottom-end" \| "left-start" \| "left-end" \| "right-start" \| "right-end"` | `"bottom-start"` | Position |
| `data-offset` | number | `0` | Pixel gap from anchor |
| `data-flip` | `"true" \| "false"` | `"true"` | Flip to opposite side when there's no room |
| `data-shift` | `"true" \| "false"` | `"true"` | Slide along the edge when there's no room |

The anchor can also be set as a property: `el.anchor = element` for
when you don't have a stable id.

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

The exported `position()` function is what the behavior uses
internally — call it directly when you don't want the data-attribute
machinery.

## What it sets

The element gets `position: fixed`, `top`, `left`, and a
`data-state="placement-X"` attribute reflecting the actual placement
after flip. Use the state attribute for direction-aware styling:

```css
[data-anchor][data-state="placement-top"]    { transform-origin: bottom }
[data-anchor][data-state="placement-bottom"] { transform-origin: top }
```

## See also

- [`@vyn/ui/popover`](/ui/popover/) — anchor + open/close + dismiss
- [`@vyn/ui/tooltip`](/ui/tooltip/) — anchor + dismiss + describedby + hover/focus

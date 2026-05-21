---
title: auto-resize
description: A textarea that grows with its content. No JS to call; apply the attribute and import the module.
sidebar:
  order: 17
---

`@vyn/ui/auto-resize` makes a `<textarea>` grow to fit its content
as the user types. No fixed `rows` attribute, no scrollbar until a
configurable maximum.

```html
<textarea data-auto-resize data-max-rows="10"
          placeholder="Write a note…"></textarea>
```

```ts
import "@vyn/ui/auto-resize";
```

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-auto-resize` | boolean | required | Activates the behavior |
| `data-min-rows` | number | `1` | Minimum visible rows |
| `data-max-rows` | number | unset (no cap) | Maximum visible rows; scrollbar appears past this |

## What it does

- Sets `box-sizing: border-box` and removes the textarea's resize
  handle.
- On `input`, measures the scroll height and sets `height` to fit
  the content, clamped to `min-rows` and `max-rows`.
- Recomputes on font-size changes, parent resize (ResizeObserver),
  and programmatic value changes (via MutationObserver on the
  `value` attribute — for property changes, the input event covers
  it).

## See also

- [Components guide](/vyn/guide/components/) — for writing your own input behaviors

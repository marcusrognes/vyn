---
title: <v-tooltip>
description: A small floating label triggered by hover or focus. Esc dismisses; never traps focus; never blocks content underneath.
---

A short string of text floating near an element, shown on hover or
keyboard focus. Tooltips are for **supplementary** information — the
target's accessible name should make it usable WITHOUT the tooltip,
because the tooltip is invisible to touch users.

```html
<v-tooltip for="save" placement="bottom">Saves the current draft (⌘S)</v-tooltip>
<v-button id="save"><svg>…</svg></v-button>
```

```ts
import "@vyn/ui/tooltip";
```

That's it — the tooltip listens for hover/focus on its target and
shows itself. No JS wiring needed for the common case.

## Slots

| Slot | What goes in it |
|---|---|
| (default) | The tooltip text. Plain text is the recommended content; rich content reduces accessibility |

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `for`             | string  | unset    | id of the target element |
| `placement`       | `"top" \| "bottom" \| "left" \| "right"` | `"top"` | Position |
| `offset`          | number  | `4`     | Pixel gap from target |
| `show-delay`      | number  | `500`   | ms before showing on hover (no delay on focus) |
| `hide-delay`      | number  | `0`     | ms before hiding when hover leaves |
| `open`            | boolean | `false` | Reflects open state; rarely set manually |

The target can also be assigned by property: `tooltip.target = el`.

## Events

| Event | Detail | When |
|---|---|---|
| `open`  | `{}` | Tooltip shown |
| `close` | `{ reason: "blur" \| "leave" \| "escape" \| "programmatic" }` | Tooltip hidden |

## Keyboard

| Key | Effect |
|---|---|
| (target focus) | Show tooltip immediately (no delay) |
| (target blur)  | Hide tooltip |
| `Esc`          | Hide tooltip (while shown) — focus stays on the target |

The tooltip never receives focus. It's not interactive.

## ARIA

| Element | Attribute | Value |
|---|---|---|
| target    | `aria-describedby` | tooltip's id |
| tooltip   | `role`             | `"tooltip"` |
| tooltip   | `id`               | auto-generated if not set |

`aria-describedby` (not `aria-labelledby`) is the right ARIA pattern
for tooltips — the target has its OWN accessible name, and the
tooltip describes it.

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-tooltip-bg`     | `CanvasText`         | Background (dark on light themes) |
| `--vyn-tooltip-fg`     | `Canvas`             | Foreground |
| `--vyn-tooltip-radius` | `4px`                | Corner radius |
| `--vyn-tooltip-padding`| `4px 8px`            | Content padding |
| `--vyn-tooltip-font`   | `0.875em`            | Font size |
| `--vyn-tooltip-z`      | `1100`               | z-index (above popovers) |

## Accessibility notes

- **The target MUST have an accessible name without the tooltip.**
  An icon-only button labeled `<v-button aria-label="Save">` with a
  tooltip "Save (⌘S)" is fine; an icon-only button with no
  `aria-label` and a "Save" tooltip is broken for touch and
  voice-control users.
- The tooltip is invisible to touch users by design. Don't put
  critical information in it.
- The tooltip is invisible to forced-colors mode by default; the
  CSS uses a high-contrast pair via `CanvasText` / `Canvas` so it
  remains readable.
- `prefers-reduced-motion: reduce` removes the fade transition.
- Don't use tooltips for form errors. Use inline error text near
  the input.

## Programmatic control

```ts
tooltip.show();
tooltip.hide();
tooltip.target = el;
```

## See also

- [`<v-popover>`](/ui/popover/) — interactive floating content
- [`<v-button>`](/ui/button/) — buttons that often pair with tooltips

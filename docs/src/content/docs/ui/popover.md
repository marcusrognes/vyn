---
title: <v-popover>
description: A non-modal positioned overlay anchored to a trigger. Closes on outside click and Esc; doesn't trap focus.
---

A non-modal overlay positioned relative to an anchor element. Use it
when you need floating content (hint cards, attribute editors,
filters) that should dismiss on outside click but should NOT block
the rest of the page — for blocking modals, use
[`<v-dialog>`](/ui/dialog/).

```html
<button id="filters">Filters</button>

<v-popover anchor="filters" placement="bottom-start">
	<form>
		<label>Min <input type="number" name="min" /></label>
		<label>Max <input type="number" name="max" /></label>
	</form>
</v-popover>
```

```ts
import "@vyn/ui/popover";

const popover = document.querySelector("v-popover")!;
document.querySelector("#filters")!.addEventListener("click", () => {
	popover.open = !popover.open;
});
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | Any content. Focusable elements receive normal Tab order; the popover does NOT trap focus |

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `anchor`        | string  | unset  | id of the anchor element (the trigger) |
| `placement`     | `"top" \| "bottom" \| "left" \| "right" \| "top-start" \| "top-end" \| "bottom-start" \| "bottom-end" \| "left-start" \| "left-end" \| "right-start" \| "right-end"` | `"bottom-start"` | Position relative to anchor |
| `offset`        | number  | `4`    | Pixel gap from anchor |
| `open`          | boolean | `false`| Reflects open state; set to toggle |
| `flip`          | boolean | `true` | Flip to the opposite side when there's no room |
| `dismiss-on-outside-click` | boolean | `true` | Close when user clicks outside |
| `dismiss-on-escape` | boolean | `true` | Close on Esc |

The anchor can also be set as a property (`popover.anchor = el`) for
cases where you don't have a stable id.

## Events

| Event | Detail | When |
|---|---|---|
| `open`    | `{}` | Popover opened |
| `close`   | `{ reason: "outside" \| "escape" \| "programmatic" }` | Popover closed |
| `reposition` | `{ placement }` | Position was recomputed (resize, scroll, or flip) |

## Keyboard

| Key | Effect |
|---|---|
| `Esc` | Close (when `dismiss-on-escape` is true). Focus returns to the anchor |

Tab moves through focusable content normally. The popover does not
trap focus — tabbing past the last item moves focus out and closes
the popover.

## ARIA

| Element | Attribute | Value |
|---|---|---|
| anchor    | `aria-haspopup`  | `"true"` (set automatically when the popover references it) |
| anchor    | `aria-expanded`  | `"true"` / `"false"` |
| anchor    | `aria-controls`  | popover's id |
| popover   | `role`           | not set — popover is not a landmark; consumers add `role` if needed |

For menu-flavored popovers, add `role="menu"` and use
[`<v-menu>`](/ui/menu/) inside.

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-popover-bg`     | `Canvas`             | Background |
| `--vyn-popover-border` | `1px solid CanvasText` | Border |
| `--vyn-popover-shadow` | `0 2px 8px rgba(0,0,0,0.15)` | Drop shadow |
| `--vyn-popover-radius` | `4px`                | Corner radius |
| `--vyn-popover-padding`| `8px`                | Content padding |
| `--vyn-popover-z`      | `1000`               | z-index |

## Accessibility notes

- The popover does NOT trap focus. Users can Tab through, into, and
  out of the popover. For modal behavior, use
  [`<v-dialog>`](/ui/dialog/).
- Focus returns to the anchor on close — except when the user
  Tabbed past the end, in which case focus continues normally
  outside the popover.
- The popover uses `position: fixed` and renders into the top layer
  on browsers that support it (via the native Popover API where
  available); on older browsers it falls back to fixed positioning
  with manual z-index.
- A popover with no anchor (positioning manually via
  `popover.x` / `popover.y`) gets no `aria-haspopup` wiring — set
  ARIA on the triggering element yourself.

## Programmatic control

```ts
popover.open = true;            // open
popover.open = false;           // close
popover.toggle();
popover.x = 100; popover.y = 200;  // manual positioning
popover.anchor = anchorEl;      // assign anchor by reference
popover.reposition();           // force a recomputation
```

## See also

- [`<v-dialog>`](/ui/dialog/) — modal alternative with focus trap
- [`<v-tooltip>`](/ui/tooltip/) — hover/focus-driven brief content
- [`<v-dropdown>`](/ui/dropdown/) — popover + menu combined

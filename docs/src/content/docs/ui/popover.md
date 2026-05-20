---
title: popover
description: Anchored open-on-trigger floating element with outside-click and Esc dismissal. Composes anchor + dismiss + show/hide.
sidebar:
  order: 7
---

`@vyn/ui/popover` is the canonical floating-overlay behavior. It
composes [`anchor`](/ui/anchor/) for positioning and
[`dismiss`](/ui/dismiss/) for closing, plus open/close state via a
trigger element. Use it for non-modal overlays: filters, attribute
editors, hint cards, dropdown menus.

For modal behavior (focus trap + backdrop), use native `<dialog>`
plus [`focus-trap`](/ui/focus-trap/).

```html
<button id="filters-trigger" data-popover-trigger="filters">Filters</button>

<div id="filters"
     data-popover data-anchor="filters-trigger"
     data-placement="bottom-start" data-offset="4">
	<form>
		<label>Min <input type="number" name="min" /></label>
		<label>Max <input type="number" name="max" /></label>
	</form>
</div>
```

```ts
import "@vyn/ui/popover";
```

That's the whole popover. Trigger click toggles open; outside click
and Esc dismiss; positioning sticks through scroll and resize.

## Attributes (on the popover)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-popover` | boolean | required | Activates the behavior |
| `data-anchor` | string | required | id of the anchor (the trigger or any element) |
| `data-placement` | placement string | `"bottom-start"` | See [anchor](/ui/anchor/) |
| `data-offset` | number | `4` | Pixel gap |
| `data-open` | boolean | `false` | Open state; reflected; assign to toggle |
| `data-dismiss-on` | string | `"escape outside"` | See [dismiss](/ui/dismiss/) |

## Attributes (on the trigger)

| Attribute | What it does |
|---|---|
| `data-popover-trigger` | id of the popover; sets `aria-haspopup` / `aria-expanded` / `aria-controls` and toggles the popover on click |

If you want a different trigger pattern (hover, focus, programmatic),
omit `data-popover-trigger` and set `data-open` yourself.

## Events

| Event | Detail | When |
|---|---|---|
| `open`       | `{}` | Popover opened |
| `close`      | `{ reason: "outside" \| "escape" \| "focus-out" \| "programmatic" }` | Popover closed |
| `reposition` | `{ placement }` | Position recomputed |

## ARIA

The trigger receives:

- `aria-haspopup="true"`
- `aria-expanded="true"` / `"false"`
- `aria-controls="popover-id"`

The popover itself does NOT receive a role — popovers are not
landmarks. Apply `role="menu"`, `role="dialog"`, etc. as needed.

## Programmatic control

```ts
import { popover } from "@vyn/ui/popover";

popover(el).open();
popover(el).close();
popover(el).toggle();
```

Or via the data-attribute:

```ts
el.dataset.open = "true";
el.dataset.open = "false";
```

## See also

- [`@vyn/ui/anchor`](/ui/anchor/) — positioning primitive used internally
- [`@vyn/ui/dismiss`](/ui/dismiss/) — dismissal primitive used internally
- [`@vyn/ui/focus-trap`](/ui/focus-trap/) — for modal popovers

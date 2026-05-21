---
title: sortable
description: Drag to reorder a list. Pointer + keyboard accessible. Emits reorder events with the before/after index.
sidebar:
  order: 15
---

`@vyn/ui/sortable` turns a list into a reorderable one. Items can
be dragged with the mouse, picked up with the keyboard, and dropped
into a new position. Emits a `reorder` event with the moved item and
its new index; the consumer updates the data.

For cross-container drag-and-drop (moving items between lists), see
[`drag-drop`](/vyn/ui/drag-drop/).

```html
<ul data-sortable>
	<li data-key="task-1">Buy milk</li>
	<li data-key="task-2">Walk dog</li>
	<li data-key="task-3">Write doc</li>
</ul>
```

```ts
import "@vyn/ui/sortable";

document.querySelector("ul")!.addEventListener("reorder", (e) => {
	const { key, fromIndex, toIndex } = (e as CustomEvent<{
		key: string;
		fromIndex: number;
		toIndex: number;
	}>).detail;
	// reorder your data
});
```

## Attributes (on the container)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-sortable` | boolean | required | Activates the behavior |
| `data-items` | CSS selector | `":scope > *"` | Selector for sortable items |
| `data-handle` | CSS selector | unset | If set, only drag from elements matching this selector inside each item |
| `data-axis` | `"y" \| "x" \| "both"` | `"y"` | Axis to constrain dragging on |
| `data-disabled` | boolean | absent | Disable reordering temporarily |

## Attributes (on items)

| Attribute | What it does |
|---|---|
| `data-key` | Stable id surfaced in the `reorder` event |
| `data-no-drag` | Items with this attribute are immovable (but other items can move past them) |

## Events

| Event | Detail | When |
|---|---|---|
| `dragstart` | `{ key: string }` | A drag started |
| `reorder`   | `{ key: string; fromIndex: number; toIndex: number }` | Drag committed; the DOM has already been updated. Cancelable to revert |
| `dragend`   | `{ key: string; committed: boolean }` | Drag ended (committed or cancelled) |

To prevent a reorder (e.g., server-side validation failed), call
`event.preventDefault()` on `reorder`; the DOM reverts to the
pre-drag order.

## Keyboard

When an item (or its handle) has focus:

| Key | Effect |
|---|---|
| `Space`, `Enter` | Pick up / drop the item |
| `ArrowDown`, `ArrowUp` (after pickup) | Move down/up one position |
| `Home`, `End` (after pickup) | Move to first / last |
| `Esc` (after pickup) | Cancel; restore original position |

While picked up, the item visually lifts (via `data-state="picked"`)
and a live region announces "Item picked up. Press up and down to
move, Enter to drop, Escape to cancel."

## ARIA and `data-state`

| Attribute | When |
|---|---|
| `aria-grabbed="true"` | On the picked-up item |
| `data-state="picked"` | Same; for CSS targeting |
| `data-state="dragging"` | On the item being dragged with a pointer |

## Touch and pointer

The behavior uses Pointer Events, so touch, stylus, and mouse all
work. On touch, a 300ms long-press picks up the item (avoiding
conflict with scroll); set `data-handle` to a dedicated handle to
remove the delay.

## See also

- [`@vyn/ui/drag-drop`](/vyn/ui/drag-drop/) — cross-container drag-and-drop
- [`@vyn/ui/keyboard-nav`](/vyn/ui/keyboard-nav/) — for keyboard-only navigation between items when not reordering

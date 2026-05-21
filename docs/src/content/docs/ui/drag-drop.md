---
title: drag-drop
description: Cross-container drag-and-drop with a keyboard fallback and typed drop zones. Move items between lists; transform between drop targets; the framework handles announcements.
sidebar:
  order: 16
---

`@vyn/ui/drag-drop` lets users move elements from a `data-drag`
container into a `data-drop` zone. Unlike [`sortable`](/vyn/ui/sortable/)
(which reorders within one list), `drag-drop` is for moving items
between lists, into trash zones, or onto canvas surfaces.

Pointer-driven and keyboard-accessible. Drop zones can declare what
data types they accept; the framework matches them and emits a
typed `drop` event with the moved item and the source/destination
containers.

```html
<ul data-drag data-drag-type="todo">
	<li data-key="t-1">Buy milk</li>
	<li data-key="t-2">Walk dog</li>
</ul>

<ul data-drop data-accepts="todo">
	<li data-key="t-3">Write doc</li>
</ul>

<div data-drop data-accepts="todo" class="trash">
	🗑 Drop here to delete
</div>
```

```ts
import "@vyn/ui/drag-drop";

document.addEventListener("drop", (e) => {
	const { key, from, to, type } = (e as CustomEvent<{
		key: string;
		from: HTMLElement;
		to:   HTMLElement;
		type: string;
	}>).detail;

	if (to.classList.contains("trash")) {
		rpc.todos.remove.mutate({ _id: key });
	} else {
		rpc.todos.move.mutate({ _id: key, listId: to.dataset.listId });
	}
});
```

## Attributes (on draggable containers)

| Attribute | Type | What it does |
|---|---|---|
| `data-drag` | boolean | Marks the container as a source of draggable items |
| `data-drag-type` | string | The type tag of items in this container (drop zones match) |
| `data-drag-items` | CSS selector | Selector for draggable items (default `":scope > *"`) |
| `data-drag-handle` | CSS selector | Only drag from elements matching this within an item |

## Attributes (on drop zones)

| Attribute | Type | What it does |
|---|---|---|
| `data-drop` | boolean | Marks the element as a drop target |
| `data-accepts` | space-separated types | Which `data-drag-type`s this zone accepts |
| `data-drop-mode` | `"append" \| "replace" \| "none"` | What happens to the item on drop. `"append"` adds it; `"replace"` swaps the zone's content; `"none"` leaves DOM alone (use when you'll re-render from data) |

## Attributes (on items)

| Attribute | What it does |
|---|---|
| `data-key` | Stable id surfaced in `drop` event |
| `data-no-drag` | Items with this attribute are not draggable |

## Events (on the document or any common ancestor)

| Event | Detail | When |
|---|---|---|
| `dragstart` | `{ key, from, type }` | Drag started |
| `dragover`  | `{ key, over, accepted }` | Pointer over a possible drop target; `accepted` is true if the type matches |
| `drop`      | `{ key, from, to, type }` | Item dropped on an accepting zone. Cancelable |
| `dragend`   | `{ key, committed }` | Drag ended (committed or cancelled) |

Calling `event.preventDefault()` on `drop` cancels the move; the DOM
reverts.

## Keyboard

Each item is focusable. When focused:

| Key | Effect |
|---|---|
| `Space`, `Enter` | Pick up |

After pickup, focus jumps to the first accepting drop zone; arrow
keys (or Tab) cycle through accepting zones; Enter drops; Esc cancels.
A live region announces "Item picked up. Available drop zones: …" so
screen-reader users hear what's available.

## ARIA and `data-state`

| Attribute | When |
|---|---|
| `aria-grabbed="true"` | On the picked-up item |
| `data-state="picked"` | Same; for CSS |
| `data-state="drop-target"` | On the zone currently under the pointer (or under keyboard cursor) |
| `data-state="drop-accept"` | On every zone that would accept this item |
| `data-state="drop-reject"` | On every zone that would reject this item |

Use the state attributes for hover/highlight styling without
writing JS:

```css
[data-drop][data-state="drop-accept"] {
	outline: 2px dashed Highlight;
}
[data-drop][data-state="drop-target"][data-state*="accept"] {
	outline-style: solid;
}
```

## Cross-window?

By default, drag-drop is **within one document**. For cross-window
or external file drops, use the native HTML5 DataTransfer API.

## See also

- [`@vyn/ui/sortable`](/vyn/ui/sortable/) — within-list reordering
- [`@vyn/ui/keyboard-nav`](/vyn/ui/keyboard-nav/) — for non-drag list navigation

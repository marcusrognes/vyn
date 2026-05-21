---
title: sort
description: Column-header sort buttons with aria-sort wiring. Apply data-sort to the thead (or any container); data-sort-key on each sortable header. One event from one place.
sidebar:
  order: 13
---

`@vyn/ui/sort` turns elements with `data-sort-key="..."` into
keyboard-accessible sort buttons. Apply `data-sort` to the container
(typically the `<thead>`); apply `data-sort-key` to each sortable
header. The container scopes the "one column at a time" rule and is
where the `sort` event lands.

The behavior is controlled: the event tells you what changed; you
decide how to sort (client-side, server-side, hybrid) and pass the
result back.

```html
<table>
	<thead data-sort>
		<tr>
			<th data-sort-key="name">Name</th>
			<th data-sort-key="email">Email</th>
			<th data-sort-key="createdAt" data-sort-direction="desc">Joined</th>
			<th>Actions</th>
		</tr>
	</thead>
	<tbody>…</tbody>
</table>
```

```ts
import "@vyn/ui/sort";

document.querySelector("thead")!.addEventListener("sort", (e) => {
	const { key, direction } = (e as CustomEvent<{
		key: string;
		direction: "asc" | "desc" | null;
	}>).detail;
	// reorder your data
});
```

## Attributes (on the container)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-sort` | boolean | required | Activates the behavior; scopes single-active-sort to this container |
| `data-sort-multi` | `"true" \| "false"` | `"false"` | Allow multiple columns sorted simultaneously (multi-column sort) |

## Attributes (on items)

| Attribute | Type | What it does |
|---|---|---|
| `data-sort-key` | string | Stable id surfaced in the `sort` event |
| `data-sort-direction` | `"asc" \| "desc" \| ""` | Current direction. Set by the behavior on the active header; cleared on the others (unless `data-sort-multi`) |
| `data-sort-default` | `"asc" \| "desc"` | Initial direction when first activating (default `"asc"`) |
| `data-sort-disabled` | boolean | Header isn't sortable; not focusable |

## Events

| Event | Detail | When |
|---|---|---|
| `sort` | `{ key: string; direction: "asc" \| "desc" \| null; sortState: Array<{key, direction}> }` | A sort header was activated. `direction` is `null` when cycling back to unsorted. `sortState` is the full active sort list (for multi-column) |

The event fires on the **container** (the `data-sort` element), not
on each header. One listener at the thead level covers every column.

The cycle is **asc → desc → unsorted → asc → ...** by default
(or `desc → asc → unsorted → desc → ...` when
`data-sort-default="desc"`).

## Keyboard

| Key | Effect |
|---|---|
| `Enter`, `Space` (on sortable header) | Activate; cycle direction |
| `Tab` / `Shift+Tab` | Move between sortable headers (native focus order) |

Sort headers are made focusable automatically — the behavior sets
`tabindex="0"` and `role="button"` on each `[data-sort-key]`
element.

## ARIA

| Element | Attribute | Value |
|---|---|---|
| sortable header | `role` | `"button"` (delegated within the `<th>`) |
| sortable header | `aria-sort` | `"ascending"` / `"descending"` / `"none"` |

Screen readers announce the sort state ("Name, sortable, ascending").

## Multi-column sort

With `data-sort-multi="true"`, activating a column adds it to the
sort stack instead of replacing the active column. The event's
`sortState` array carries the full ordered list. The user clears a
column by cycling it back to unsorted.

```html
<thead data-sort data-sort-multi="true">
	<tr>
		<th data-sort-key="status">Status</th>
		<th data-sort-key="priority">Priority</th>
		<th data-sort-key="updatedAt">Updated</th>
	</tr>
</thead>
```

## See also

- [`<v-table>`](/vyn/ui/table/) — composes this for the prebuilt sortable table
- [`<v-grid>`](/vyn/ui/grid/) — composes this for the data-driven grid

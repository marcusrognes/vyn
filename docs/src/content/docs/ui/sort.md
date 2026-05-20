---
title: sort
description: Column-header sort buttons with aria-sort wiring. Apply to any table header to make it a sortable button that fires a sort event.
sidebar:
  order: 13
---

`@vyn/ui/sort` turns elements with `data-sort-key="..."` into
keyboard-accessible sort buttons. It manages `aria-sort` state and
fires a `sort` event the consumer responds to.

The behavior is controlled: the sort event tells you what changed;
you decide how to sort (client-side, server-side, hybrid) and pass
the result back.

```html
<table>
	<thead>
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

## Attributes

| Attribute | Type | What it does |
|---|---|---|
| `data-sort-key` | string | id surfaced in the `sort` event |
| `data-sort-direction` | `"asc" \| "desc" \| ""` | Current sort direction. Set on the active header; cleared on the others |
| `data-sort-default` | `"asc" \| "desc"` | Initial direction when activating (default `"asc"`) |

The behavior writes `data-sort-direction` on the active header and
clears it on the others (one column sorted at a time by default).
For multi-column sort, listen to `sort` and manage direction yourself.

## Events

| Event | Detail | When |
|---|---|---|
| `sort` | `{ key: string; direction: "asc" \| "desc" \| null }` | A sort header activated. `direction` is `null` when the user clicks again to clear sort |

The cycle is **asc → desc → unsorted → asc → ...** (or configurable
per header via `data-sort-default="desc"` to start with descending).

## Keyboard

| Key | Effect |
|---|---|
| `Enter`, `Space` (on sort header) | Activate; cycle direction |

The sort headers must be focusable. The behavior sets `tabindex="0"`
and `role="button"` on each `[data-sort-key]` element automatically.

## ARIA

| Element | Attribute | Value |
|---|---|---|
| sortable header | `role` | `"button"` (within the header cell) |
| sortable header | `aria-sort` | `"ascending"` / `"descending"` / `"none"` |

Screen readers announce the sort state, so "Name, sortable, ascending"
is what users hear.

## See also

- [`<v-table>`](/ui/table/) — composes this for the prebuilt sortable table
- [`<v-grid>`](/ui/grid/) — composes this for the data-driven grid

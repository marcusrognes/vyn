---
title: <v-grid>
description: A keyboard-navigable data grid built from divs with the ARIA grid pattern. Two-dimensional arrow-key navigation, sortable columns, optional inline editing.
---

A two-dimensional data grid. Unlike [`<v-table>`](/ui/table/) which
wraps the native `<table>` element and is the right choice for
read-mostly tabular data, `<v-grid>` is the right choice when you
need a spreadsheet-like experience: cell-level focus, range
selection, inline editing, sortable columns, and full keyboard
control over a large dataset.

The grid is data-driven — you assign `columns` and `items`
properties, the grid renders rows. There is no slot-based authoring
for cells; that pattern doesn't scale to 10k rows.

```html
<v-grid id="users" selection="row" sortable></v-grid>
```

```ts
import "@vyn/ui/grid";

const grid = document.querySelector<HTMLElement & {
	columns: GridColumn[];
	items: unknown[];
}>("#users")!;

grid.columns = [
	{ id: "name",  label: "Name",  sortable: true,  width: "minmax(8rem, 2fr)" },
	{ id: "email", label: "Email", sortable: true,  width: "minmax(12rem, 3fr)" },
	{ id: "role",  label: "Role",  editable: true,  width: "8rem" },
	{ id: "createdAt", label: "Joined", format: (v: number) => new Date(v).toLocaleDateString() },
];
grid.items = await rpc.users.list.query({});

grid.addEventListener("change", (e) => {
	const { row, column, value } = (e as CustomEvent<{ row: unknown; column: string; value: unknown }>).detail;
	rpc.users.update.mutate({ _id: (row as { _id: string })._id, [column]: value });
});
```

## Slots

`<v-grid>` does not use slots. Configure via `columns` and `items`
properties. For empty-state and loading-state customization, use the
attributes below or hide the grid until items load.

## Properties (set in JS)

| Property | Type | What it does |
|---|---|---|
| `columns` | `GridColumn[]` | Column definitions. See below |
| `items`   | `unknown[]`    | Row data. Each item must have a stable identity — see `getKey` |
| `getKey`  | `(item: unknown, index: number) => string` | Returns the unique key for a row. Defaults to `item._id` if present, else index |
| `selection` | `"none" \| "cell" \| "row" \| "range"` | Selection mode |
| `selectedRows`  | `string[]` | Two-way: ids of selected rows when `selection="row"` |
| `selectedCells` | `Array<{ row: string; column: string }>` | Two-way: selected cells when `selection="cell"` or `"range"` |

```ts
type GridColumn = {
	id:         string;                  // matches the item's property key, unless `value` is given
	label:      string;                  // header text
	value?:     (row: unknown) => unknown; // derive a value when not a plain property
	format?:    (v: unknown, row: unknown) => string | Node; // displayed string or DOM node
	sortable?:  boolean;                 // header is a sort button
	editable?:  boolean;                 // cells are editable (Enter / F2 to edit)
	align?:     "start" | "center" | "end";
	width?:     string;                  // CSS grid track size; e.g. "8rem", "minmax(0, 1fr)"
	sticky?:    "start" | "end";         // sticky column on horizontal scroll
};
```

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `selection` | string | `"cell"` | Same as property; can be set in HTML |
| `sortable`  | boolean | `false` | Enables column-header sort UI. Per-column overrides via `columns[i].sortable` |
| `loading`   | boolean | `false` | Shows a loading indicator and disables interaction |
| `empty-message` | string | `"No items"` | Shown when `items.length === 0` |
| `row-height` | string | `"2em"` | CSS height per row |

## Events

| Event | Detail | When |
|---|---|---|
| `focuschange` | `{ row: string; column: string }` | Focus moved to a different cell |
| `select`      | `{ rows: string[]; cells: Array<{row, column}> }` | Selection changed (debounced 16ms) |
| `sort`        | `{ column: string; direction: "asc" \| "desc" \| null }` | Column header activated. The grid does NOT sort `items` itself — you receive this event and update `items` to the sorted array |
| `change`      | `{ row: unknown; column: string; value: unknown; oldValue: unknown }` | An editable cell was committed |
| `activate`    | `{ row: unknown }` | A row was activated (Enter on a non-editable row, double-click on row mode) |

The grid is **controlled** for sorting: you decide how sorting works
(client-side via Array.sort, server-side via a query refetch, hybrid
caching) and pass the result back.

## Keyboard

| Key | Effect |
|---|---|
| `ArrowDown`, `ArrowUp`, `ArrowLeft`, `ArrowRight` | Move focus by one cell |
| `Home`, `End`           | First / last cell of the current row |
| `Ctrl+Home`, `Ctrl+End` | First / last cell of the grid |
| `PageDown`, `PageUp`    | Move focus by one viewport (computed from row height + visible area) |
| `Space`                 | Toggle row selection (in `row` mode); toggle cell selection (in `cell`/`range` mode) |
| `Shift+Click`, `Shift+Arrows` | Extend selection in `range` mode |
| `Ctrl+A`                | Select all rows (in `row` mode); select all cells (in `range` mode) |
| `Enter` (header)        | Sort by this column; cycle asc → desc → unsorted |
| `Enter` or `F2` (editable cell) | Enter edit mode |
| `Esc` (editing)         | Cancel edit; original value restored |
| `Enter` or `Tab` (editing) | Commit edit; fires `change`. `Tab` moves to next cell |

In edit mode the cell renders a focused `<input>` (or `<select>` / `<textarea>`
depending on the column config); the grid's keyboard handling pauses
until edit is committed or cancelled.

## ARIA

| Element | Attribute | Value |
|---|---|---|
| `<v-grid>` | `role`          | `"grid"` |
| `<v-grid>` | `aria-rowcount` | total row count (including off-screen if virtualized) |
| `<v-grid>` | `aria-colcount` | column count |
| `<v-grid>` | `aria-multiselectable` | `"true"` when `selection="row"` or `"range"` allow multi |
| row        | `role`          | `"row"` |
| row        | `aria-rowindex` | 1-based row index |
| row        | `aria-selected` | when selected |
| cell       | `role`          | `"gridcell"` (or `"columnheader"` / `"rowheader"`) |
| cell       | `aria-colindex` | 1-based column index |
| cell       | `aria-selected` | when selected |
| cell       | `tabindex`      | `0` on the focused cell, `-1` elsewhere (roving) |
| column header (sortable) | `aria-sort` | `"ascending"` / `"descending"` / `"none"` |

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-grid-bg`              | `Canvas`             | Grid background |
| `--vyn-grid-fg`              | `CanvasText`         | Cell foreground |
| `--vyn-grid-border`          | `1px solid CanvasText` | Cell + header borders |
| `--vyn-grid-header-bg`       | `ButtonFace`         | Header row background |
| `--vyn-grid-header-fg`       | `ButtonText`         | Header foreground |
| `--vyn-grid-row-hover-bg`    | `Highlight`          | Row hover background (in `row` mode) |
| `--vyn-grid-row-selected-bg` | `Highlight`          | Selected row background |
| `--vyn-grid-cell-padding`    | `0.25em 0.5em`       | Cell padding |
| `--vyn-grid-cell-focus-ring` | (global)             | Focused-cell outline |
| `--vyn-grid-edit-bg`         | `Canvas`             | Edit input background |

## Accessibility notes

- **Each cell takes one tab stop.** The grid uses roving tabindex so
  the grid as a whole is one stop in the page's Tab order. Once
  focused, arrow keys navigate cells.
- **Sort is keyboard-accessible.** Sortable column headers are
  buttons; Enter activates them. The current sort direction is
  announced via `aria-sort` so screen readers can read it.
- **Row mode treats the row as the activatable unit.** `aria-selected`
  is on the row; `aria-rowindex` is announced. Cell-level focus still
  exists for keyboard nav, but the selection model is row-grain.
- **Edit mode preserves focus.** When committing or cancelling an
  edit, focus returns to the grid cell so arrow keys keep working.
- **Large datasets need virtualization.** The current implementation
  renders every row; rendering >5000 rows starts to feel slow on
  low-end devices. A `<v-virtual-grid>` is in the roadmap (see
  [Open questions](/ui/#open-questions)).

## Programmatic control

```ts
grid.focusCell({ row: "user-7", column: "email" });
grid.selectedRows = ["user-3", "user-7"];
grid.scrollToRow("user-42");
grid.beginEdit({ row: "user-7", column: "role" });
grid.commitEdit();
grid.cancelEdit();
```

## Example: sortable + editable + row select

```ts
const grid = document.querySelector("v-grid") as any;

grid.columns = [
	{ id: "name",  label: "Name",  sortable: true },
	{ id: "email", label: "Email", sortable: true },
	{ id: "role",  label: "Role",  editable: true },
];
grid.items = await rpc.users.list.query({});
grid.selection = "row";

grid.addEventListener("sort", (e: CustomEvent) => {
	const { column, direction } = e.detail;
	grid.items = sortBy(grid.items, column, direction);
});

grid.addEventListener("change", async (e: CustomEvent) => {
	const { row, column, value } = e.detail;
	await rpc.users.update.mutate({ _id: row._id, [column]: value });
});

grid.addEventListener("activate", (e: CustomEvent) => {
	location.href = `/users/${e.detail.row._id}/`;
});
```

## See also

- [`<v-table>`](/ui/table/) — wraps native `<table>`; simpler, less power
- [`<v-listbox>`](/ui/listbox/) — for single-column selection
- [Components guide](/guide/components/) — for writing your own

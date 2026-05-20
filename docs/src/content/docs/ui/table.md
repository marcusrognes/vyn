---
title: <v-table>
description: A sortable data table built on the native <table> element. Keyboard cell navigation, sortable columns, and read-mostly semantics. For spreadsheet-like editing use <v-grid>.
---

A wrapper around the native `<table>` that adds keyboard cell
navigation, sortable column headers, and accessible row selection.
Use it for read-mostly tabular data — feeds, lists, dashboards —
where the native semantics carry their weight. For spreadsheet-like
editing or large datasets that need virtualization, reach for
[`<v-grid>`](/ui/grid/).

`<v-table>` accepts either authored HTML (write your own `<tr>` and
`<td>` elements as children) or a data-driven config (assign
`columns` + `items` properties). The data-driven mode is the common
case; the authored mode exists for tables with hand-tuned markup.

```html
<v-table id="orders" sortable selection="row"></v-table>
```

```ts
import "@vyn/ui/table";

const table = document.querySelector<HTMLElement & {
	columns: TableColumn[];
	items: unknown[];
}>("#orders")!;

table.columns = [
	{ id: "id",       label: "#",        width: "4rem" },
	{ id: "customer", label: "Customer", sortable: true },
	{ id: "total",    label: "Total",    sortable: true, align: "end",
	  format: (v: number) => v.toFixed(2) },
	{ id: "status",   label: "Status" },
];
table.items = await rpc.orders.list.query({});

table.addEventListener("activate", (e) => {
	location.href = `/orders/${(e as CustomEvent<{ row: { _id: string } }>).detail.row._id}/`;
});
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | When using authored mode, a `<thead>` + `<tbody>` with standard table markup. Ignored when `columns` is set |

## Properties

| Property | Type | What it does |
|---|---|---|
| `columns` | `TableColumn[]` | Column definitions |
| `items`   | `unknown[]`     | Row data |
| `getKey`  | `(item, index) => string` | Stable id; defaults to `item._id` or index |

```ts
type TableColumn = {
	id:        string;
	label:     string;
	value?:    (row: unknown) => unknown;
	format?:   (v: unknown, row: unknown) => string | Node;
	sortable?: boolean;
	align?:    "start" | "center" | "end";
	width?:    string;
};
```

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `sortable`   | boolean | `false` | Enable sort UI on column headers (per-column override via `columns[i].sortable`) |
| `selection`  | `"none" \| "row"` | `"none"` | Row selection mode |
| `selected`   | string  | unset    | Comma-separated row ids; two-way |
| `loading`    | boolean | `false` | Show loading state; disables interaction |
| `empty-message` | string | `"No rows"` | Shown when items is empty |

## Events

| Event | Detail | When |
|---|---|---|
| `sort`     | `{ column: string; direction: "asc" \| "desc" \| null }` | Header activated; caller updates `items` |
| `select`   | `{ rows: string[] }` | Selection changed |
| `activate` | `{ row: unknown }` | Row activated (Enter on focused row, double-click) |

Sort is controlled: the table emits the event, you decide how to
sort (client-side, server-side, cached). Pass the new `items` back.

## Keyboard

| Key | Effect |
|---|---|
| `ArrowDown`, `ArrowUp` | Move focus to next/previous row |
| `ArrowLeft`, `ArrowRight` | Move focus by cell within the row |
| `Home`, `End` | First / last cell of row |
| `Ctrl+Home`, `Ctrl+End` | First cell of first / last row |
| `PageDown`, `PageUp` | Move focus one viewport |
| `Space` | Toggle row selection (in `row` mode) |
| `Shift+ArrowDown`, `Shift+ArrowUp` | Extend selection |
| `Ctrl+A` | Select all rows |
| `Enter` | Activate row (fires `activate`) |
| `Enter` on header | Sort by column; cycles asc → desc → unsorted |

## ARIA

| Element | Attribute | Value |
|---|---|---|
| `<table>` (rendered inside) | `role` | `"table"` (native; overridden to `"grid"` only when selection is active) |
| `<th>` (sortable) | `aria-sort` | `"ascending"` / `"descending"` / `"none"` |
| `<tr>` | `aria-selected` | when selected |
| cells | `tabindex` | `0` on focused, `-1` elsewhere |

When `selection="row"` is active, the table uses
`role="grid"` for richer keyboard semantics; otherwise it stays as
the native `role="table"`.

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-table-bg`              | `Canvas`             | Background |
| `--vyn-table-fg`              | `CanvasText`         | Foreground |
| `--vyn-table-border`          | `1px solid CanvasText` | Borders |
| `--vyn-table-header-bg`       | `ButtonFace`         | Header row background |
| `--vyn-table-row-hover-bg`    | `Highlight`          | Row hover background |
| `--vyn-table-row-selected-bg` | `Highlight`          | Selected row background |
| `--vyn-table-cell-padding`    | `0.4em 0.8em`        | Cell padding |
| `--vyn-table-focus-ring`      | (global)             | Focused-cell outline |

## Accessibility notes

- The native `<table>` element carries semantic weight that
  screen readers know about (column headers, row associations,
  caption). The data-driven mode renders proper `<thead>`, `<tbody>`,
  `<th scope="col">`, and `<td>` elements.
- For a caption, set `aria-label` or `aria-labelledby` on
  `<v-table>` — the rendered table inherits it.
- `selection="row"` upgrades the role to `grid` to make
  multi-selection accessible (native `<table>` has no selection
  pattern). If you never select rows, leave it as default and the
  native semantics are preserved.
- Sort buttons are real `<button>` elements inside `<th>` — `Enter`
  activates them via native button behavior. Screen readers
  announce them as buttons with sort state from `aria-sort`.

## Programmatic control

```ts
table.selected = ["order-3", "order-7"];
table.focusRow("order-12");
table.scrollToRow("order-99");
```

## Example: server-side sort

```ts
let sort = { column: "createdAt", direction: "desc" as "asc" | "desc" | null };
async function refresh() {
	table.items = await rpc.orders.list.query({ sort });
}
table.addEventListener("sort", (e: CustomEvent) => {
	sort = { column: e.detail.column, direction: e.detail.direction };
	refresh();
});
refresh();
```

## See also

- [`<v-grid>`](/ui/grid/) — for editable / range-select / dense data
- [`<v-listbox>`](/ui/listbox/) — for single-column selection
- [Components guide](/guide/components/) — for writing your own

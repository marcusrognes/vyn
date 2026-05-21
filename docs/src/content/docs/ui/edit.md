---
title: edit
description: Inline-editable cells via data-editable. Enter to edit, Esc to cancel, Enter/Tab to commit. Renders the right input type per data-type.
sidebar:
  order: 14
---

`@vyn/ui/edit` turns any element with `data-editable` into an
inline-editable cell. Focus the element, press Enter (or F2, or
double-click), an input appears with the current text. Esc cancels;
Enter or Tab commits and fires `change`.

```html
<table>
	<tr>
		<td>Jane Doe</td>
		<td data-editable data-type="text">jane@example.com</td>
		<td data-editable data-type="select" data-options="admin,editor,viewer">editor</td>
	</tr>
</table>
```

```ts
import "@vyn/ui/edit";

document.querySelector("table")!.addEventListener("change", (e) => {
	const { value, oldValue } = (e as CustomEvent<{ value: string; oldValue: string }>).detail;
	const cell = e.target as HTMLElement;
	const row  = cell.closest("tr")!;
	// save row.dataset.id, cell's column, value
});
```

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-editable` | boolean | required | Makes the cell editable |
| `data-type` | `"text" \| "number" \| "date" \| "select" \| "checkbox" \| "textarea"` | `"text"` | Input control rendered in edit mode |
| `data-options` | comma-separated | unset | For `select` type: the option values |
| `data-pattern` | regex | unset | For `text` type: validation pattern (HTML5 `pattern` attr) |
| `data-min` / `data-max` | number/date | unset | Range validation for `number` / `date` |
| `data-readonly` | boolean | absent | Disable editing temporarily without removing `data-editable` |

The element's text content (or `data-value`) is the source of truth.
On commit, the behavior writes both — text content for display,
`data-value` for storage when the displayed string differs from the
underlying value (formatted numbers, dates, select labels).

## Events

| Event | Detail | When |
|---|---|---|
| `editstart` | `{ value: string }` | Edit mode entered |
| `change`    | `{ value: string; oldValue: string }` | Edit committed and value changed |
| `editcancel`| `{ value: string }` | Edit cancelled (Esc) |

`change` is **cancelable** — call `event.preventDefault()` to reject
the new value; the cell reverts.

## Keyboard

When the cell has focus:

| Key | Effect |
|---|---|
| `Enter`, `F2`, double-click | Enter edit mode |
| (any text key)              | Enter edit mode, the typed character starts the new value |

In edit mode:

| Key | Effect |
|---|---|
| `Enter` | Commit; focus returns to the cell |
| `Tab` / `Shift+Tab` | Commit; advance focus to the next/previous editable cell |
| `Esc` | Cancel; revert to original value; focus returns to the cell |

## What it sets

| Attribute | When |
|---|---|
| `data-state="editing"` | While in edit mode |
| `aria-readonly` | When `data-readonly` is set |

Use the state attribute for editing-mode styling:

```css
[data-editable][data-state="editing"] {
	padding: 0;
}
[data-editable][data-state="editing"] > input {
	width: 100%;
	border: 0;
}
```

## See also

- [`<v-grid>`](/vyn/ui/grid/) — composes this for spreadsheet-like grids
- [`@vyn/ui/keyboard-nav`](/vyn/ui/keyboard-nav/) — for cell-to-cell navigation between edits

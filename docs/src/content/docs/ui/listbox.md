---
title: <v-listbox>
description: A keyboard-navigable selection list with type-ahead and single or multi-select. ARIA listbox pattern.
---

A single-column selection list. Use it where the user picks one (or
several) items from a fixed set: a sidebar of categories, a member
picker, a saved-views switcher. For dropdown-shaped pickers, pair
with [`<v-popover>`](/ui/popover/). For free-typing filter +
select, use [`<v-combobox>`](/ui/combobox/).

```html
<v-listbox id="role" selection="single">
	<v-option id="admin">Admin</v-option>
	<v-option id="editor">Editor</v-option>
	<v-option id="viewer">Viewer</v-option>
	<v-option id="guest" disabled>Guest</v-option>
</v-listbox>
```

```ts
import "@vyn/ui/listbox";

document.querySelector("v-listbox")!.addEventListener("change", (e) => {
	const { value } = (e as CustomEvent<{ value: string | string[] }>).detail;
	// ...
});
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | `<v-option>` elements. Anything else is ignored for keyboard navigation |

## Attributes (on `<v-listbox>`)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `selection` | `"single" \| "multiple"` | `"single"` | Selection mode |
| `value`     | string (single) or comma-separated (multiple) | unset | Current selection; two-way |
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | Arrow-key axis |
| `typeahead-timeout` | number | `500` | ms before type-ahead buffer clears |

## Attributes (on `<v-option>`)

| Attribute | Type | What it does |
|---|---|---|
| `id`        | string  | Surfaced in `change` event |
| `disabled`  | boolean | Skipped in nav; not selectable |
| `selected`  | boolean | Reflects selected state (set by listbox) |

## Events

| Event | Detail | When |
|---|---|---|
| `change` | `{ value: string \| string[] }` | Selection changed |
| `activate` | `{ id: string }` | Option activated by Enter (useful for "open detail" patterns even when selection doesn't change) |

In single mode `value` is a string (or `null`). In multiple mode it's
an array of ids.

## Keyboard

| Key | Effect (single) | Effect (multiple) |
|---|---|---|
| `ArrowDown` / `ArrowUp` | Move focus AND select | Move focus only |
| `Home` / `End`          | First / last non-disabled option | Same |
| `Space`                 | Toggle (no-op in single since arrow already selects) | Toggle current focus |
| `Enter`                 | Fire `activate` | Fire `activate` |
| `a-z`, `0-9`            | Type-ahead | Type-ahead |
| `Ctrl+A`                | (no-op) | Select all non-disabled |
| `Shift+ArrowDown` / `Shift+ArrowUp` | (no-op) | Extend selection |

Mouse: click selects (single) or toggles (multiple); Shift+click
selects a range (multiple); Ctrl/Cmd+click toggles individual
(multiple).

## ARIA

| Element | Attribute | Value |
|---|---|---|
| `<v-listbox>` | `role`             | `"listbox"` |
| `<v-listbox>` | `aria-multiselectable` | `"true"` when `selection="multiple"` |
| `<v-listbox>` | `aria-orientation`     | from `orientation` |
| `<v-option>`  | `role`             | `"option"` |
| `<v-option>`  | `aria-selected`    | reflects selection |
| `<v-option>`  | `aria-disabled`    | when disabled |
| `<v-option>`  | `tabindex`         | `0` on focused, `-1` elsewhere |

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-listbox-bg`             | `Canvas` | Background |
| `--vyn-listbox-border`         | `1px solid CanvasText` | Border |
| `--vyn-listbox-radius`         | `4px` | Corner radius |
| `--vyn-option-padding`         | `6px 12px` | Option padding |
| `--vyn-option-hover-bg`        | `Highlight` | Hover background |
| `--vyn-option-selected-bg`     | `Highlight` | Selected background |
| `--vyn-option-selected-fg`     | `HighlightText` | Selected foreground |
| `--vyn-option-disabled-fg`     | `GrayText` | Disabled option color |

## Accessibility notes

- Single-select mode follows the W3C "selection follows focus"
  pattern by default — arrow keys both move focus and change
  selection. This is the right default for cheap option changes.
  For expensive selections, set `selection-follows-focus="false"`
  to require Enter/Space.
- Type-ahead matches the option's text content. For icon-only
  options, set `aria-label`.
- A focused listbox is part of the page's Tab order; the roving
  tabindex means once focused, arrows move within the listbox
  and Tab moves to the next focusable thing on the page.

## Programmatic control

```ts
listbox.value = "editor";                     // single
listbox.value = ["editor", "viewer"];         // multiple
listbox.focusOption("admin");
listbox.options;                              // → readonly array of <v-option>
```

## See also

- [`<v-combobox>`](/ui/combobox/) — filterable input + listbox
- [`<v-menu>`](/ui/menu/) — for command-style choices, not selection
- [`<v-radio-group>`](/ui/radio-group/) — for form-tied single select with native validation

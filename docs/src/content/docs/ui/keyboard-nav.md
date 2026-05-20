---
title: keyboard-nav
description: Arrow-key navigation, type-ahead, and roving tabindex on any HTML structure via data attributes. Apply once, no custom element required.
sidebar:
  order: 2
---

`@vyn/ui/keyboard-nav` is a single module that scans the document for
`[data-keyboard-nav]` elements and wires keyboard navigation onto
their direct children. No custom element, no wrapping JSX, no
`createApp`. Apply a few attributes, import the module, the
behavior turns on.

This is the pattern most `@vyn/ui` widgets compose internally. You
can use it directly when none of the prebuilt widgets fit.

```html
<ul data-keyboard-nav data-typeahead>
	<li data-key="copy">Copy</li>
	<li data-key="paste">Paste</li>
	<li data-key="delete" data-disabled>Delete</li>
</ul>
```

```ts
import "@vyn/ui/keyboard-nav";
```

That's it. Arrow keys now move focus between the `<li>` children;
type-ahead jumps by first letter; the disabled item is skipped;
focus is managed via roving tabindex.

## What it does

For every element with `[data-keyboard-nav]`:

- Builds a list of focusable items (direct element children by
  default; configurable via `data-items` selector)
- Sets `tabindex="0"` on the first non-disabled item, `tabindex="-1"`
  on the rest
- Listens for keydown on the container, moves focus on Arrow keys
- Optionally responds to letter keys (type-ahead)
- Skips items with `[data-disabled]`
- Re-syncs when items are added/removed (via MutationObserver)

## Attributes (on the container)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-keyboard-nav` | `"vertical" \| "horizontal" \| "grid"` | `"vertical"` | Direction. `"grid"` enables Up/Down/Left/Right; `"vertical"` only Up/Down; `"horizontal"` only Left/Right |
| `data-typeahead`   | boolean | absent | Enable letter-key jumping (matches item `textContent`) |
| `data-loop`        | `"true" \| "false"` | `"true"` | Whether arrow keys wrap at the ends |
| `data-items`       | CSS selector | `":scope > *"` | Selector that identifies focusable items |
| `data-tabbable`    | `"first" \| "active"` | `"first"` | Which item gets the initial `tabindex="0"` |

## Attributes (on items)

| Attribute | What it does |
|---|---|
| `data-key`      | Stable id surfaced in events |
| `data-disabled` | Skipped in arrow nav; not focusable; `aria-disabled="true"` |
| `data-label`    | Override the type-ahead matching string (defaults to `textContent`) |

## Events

Dispatched on the **container** (so one listener covers all items):

| Event | Detail | When |
|---|---|---|
| `focuschange` | `{ key: string \| null; item: HTMLElement }` | Focus moved to a different item |
| `activate`    | `{ key: string \| null; item: HTMLElement }` | Enter or Space on the focused item |

```ts
ul.addEventListener("activate", (e: Event) => {
	const { key } = (e as CustomEvent<{ key: string }>).detail;
	// route the user's intent
});
```

## Keyboard

| Key | Effect |
|---|---|
| `ArrowDown` / `ArrowUp` (vertical, grid) | Next / previous item |
| `ArrowRight` / `ArrowLeft` (horizontal, grid) | Next / previous item (or next/prev column in grid mode) |
| `Home` / `End` | First / last item |
| `a-z`, `0-9` (with `data-typeahead`) | Jump to next item whose label starts with the buffer; resets after 500ms |
| `Enter`, `Space` | Fires `activate` |

In grid mode, the behavior needs `data-grid-columns="N"` so it
knows how to interpret Up/Down. Items are laid out row-major.

## ARIA

The behavior writes:

- `tabindex="0"` on the focused item, `tabindex="-1"` on the rest
- `aria-disabled="true"` on items with `data-disabled`

The behavior does **not** set role attributes — you set those
yourself, because they depend on what the list semantically is
(`menu` / `listbox` / `tablist` / `grid`). For built-in role wiring,
see [`<v-menu>`](/ui/menu/), [`<v-listbox>`](/ui/listbox/), etc.

## Composing with other behaviors

`keyboard-nav` provides focus management and arrow keys. To add
selection, pair with [`@vyn/ui/select`](/ui/select/):

```html
<ul data-keyboard-nav data-select="single" data-value="editor">
	<li data-value="admin">Admin</li>
	<li data-value="editor">Editor</li>
	<li data-value="viewer">Viewer</li>
</ul>
```

```ts
import "@vyn/ui/keyboard-nav";
import "@vyn/ui/select";

ul.addEventListener("change", (e) => {
	const { value } = (e as CustomEvent<{ value: string }>).detail;
	// ...
});
```

For floating menus, also pair with [`@vyn/ui/popover`](/ui/popover/):

```html
<button data-popover-trigger="role-menu">Role ▾</button>
<ul id="role-menu" data-popover data-anchor="role-menu-trigger"
    data-keyboard-nav data-select="single" data-value="editor">
	<li data-value="admin">Admin</li>
	<li data-value="editor">Editor</li>
</ul>
```

Three behavior imports, no custom element, full keyboard + ARIA +
positioning.

## When NOT to use this

If you find yourself adding five behaviors to one element, reach for
the prebuilt widget — it composes the same behaviors but ships ARIA
roles and tested edge cases. The behavior modules are the building
blocks; the widgets are the recipes.

| Want | Use |
|---|---|
| A menu | [`<v-menu>`](/ui/menu/) (composes keyboard-nav + activate + dismiss) |
| A select | [`<v-listbox>`](/ui/listbox/) (composes keyboard-nav + select) |
| A combobox | [`<v-combobox>`](/ui/combobox/) (composes keyboard-nav + select + popover + input) |
| A grid | [`<v-grid>`](/ui/grid/) (composes keyboard-nav + select + edit + sort) |

## Implementation note

The whole module is ~120 lines. Read it if you need to understand
why an edge case behaves the way it does, or fork it if your
requirements diverge.

## See also

- [`@vyn/ui/select`](/ui/select/) — selection state wired via `data-select`
- [`@vyn/ui/popover`](/ui/popover/) — anchored positioning via `data-popover`
- [Components guide](/guide/components/) — write your own custom elements on top

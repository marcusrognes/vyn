---
title: <v-menu>
description: A keyboard-navigable menu with type-ahead, ARIA wiring, and a roving tabindex. The list primitive most other selection widgets compose.
---

A list of `<v-menuitem>` elements that responds to arrow keys,
type-ahead, and standard activation. The menu owns the roving
tabindex; you write the items, the primitive owns focus management
and ARIA.

Use it directly for context menus, command palettes, or anywhere you
need an accessible menu without the trigger-button shell that
[`<v-dropdown>`](/ui/dropdown/) provides.

```html
<v-menu id="ctx">
	<v-menuitem id="copy">Copy</v-menuitem>
	<v-menuitem id="paste">Paste</v-menuitem>
	<v-menuitem id="delete" disabled>Delete</v-menuitem>
</v-menu>
```

```ts
import "@vyn/ui/menu";

document.querySelector("v-menu")!.addEventListener("select", (e) => {
	const { id } = (e as CustomEvent<{ id: string }>).detail;
	// ...
});
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | One or more `<v-menuitem>` elements. Plain text or other elements between items are ignored for focus management. |

`<v-menuitem>` accepts text, icons, or any inline content as its
label. Use `disabled` on individual items to skip them in arrow nav.

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `aria-label`         | string  | unset    | Provide a label when the menu has no visible heading |
| `aria-labelledby`    | string  | unset    | Same, by id reference |
| `typeahead-timeout`  | number  | `500`    | ms before type-ahead buffer clears |

`<v-menuitem>` accepts:

| Attribute | Type | What it does |
|---|---|---|
| `id`       | string  | Stable id surfaced in the `select` event detail |
| `disabled` | boolean | Skipped in arrow navigation; non-focusable; `aria-disabled="true"` |
| `role`     | `"menuitem" \| "menuitemcheckbox" \| "menuitemradio"` | Defaults to `menuitem`; the others enable `checked` state |
| `checked`  | boolean | For checkbox/radio variants; reflects as `aria-checked` |

## Events

| Event | Detail | When |
|---|---|---|
| `select`   | `{ id: string }` | A non-disabled `<v-menuitem>` was activated by click, Enter, or Space |
| `focuschange` | `{ id: string }` | Focus moved to a different item (useful for previewing a destructive action) |

`select` bubbles from `<v-menuitem>` through the menu. Listen at the
menu level.

## Keyboard

| Key | Effect |
|---|---|
| `ArrowDown`, `ArrowUp` | Next / previous non-disabled item; wraps |
| `Home`, `End`          | First / last non-disabled item |
| `a-z`, `0-9`           | Type-ahead: jump to next item whose label starts with the typed string. Continues to match within the timeout; resets after |
| `Enter`, `Space`       | Activate focused item; fires `select` |
| `Esc`                  | Closes the menu by dispatching a `dismiss` event the parent can listen to |

Disabled items are skipped entirely — arrow keys move past them.

## ARIA

| Element | Attribute | Value |
|---|---|---|
| `<v-menu>`     | `role`             | `"menu"` |
| `<v-menu>`     | `tabindex`         | `0` initially; `-1` after first arrow keypress |
| `<v-menuitem>` | `role`             | `"menuitem"` / `"menuitemcheckbox"` / `"menuitemradio"` |
| `<v-menuitem>` | `tabindex`         | `0` on the focused item, `-1` on the rest (roving tabindex) |
| `<v-menuitem>` | `aria-disabled`    | `"true"` when disabled |
| `<v-menuitem>` | `aria-checked`     | For checkbox/radio variants |

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-menu-bg`               | `Canvas`             | Menu background |
| `--vyn-menu-border`           | `1px solid CanvasText` | Border |
| `--vyn-menu-radius`           | `4px`                | Corner radius |
| `--vyn-menu-padding`          | `4px 0`              | Vertical padding |
| `--vyn-menu-item-padding`     | `6px 12px`           | Item padding |
| `--vyn-menu-item-hover-bg`    | `Highlight`          | Hover/focus background |
| `--vyn-menu-item-hover-fg`    | `HighlightText`      | Hover/focus foreground |
| `--vyn-menu-item-disabled-fg` | `GrayText`           | Disabled item color |
| `--vyn-focus-ring`            | (global)             | Focus ring on items |

## Accessibility notes

- The menu is only accessible from keyboard once it has focus.
  Parents that show/hide the menu (like [`<v-dropdown>`](/ui/dropdown/))
  must call `menu.focus()` after showing it so arrow keys work
  immediately.
- Type-ahead matches on the item's accessible name (text content).
  Items with icon-only visible content should set `aria-label`.
- `role="menuitemcheckbox"` items toggle `checked` on activation
  without firing `select` — they stay open. Use `select` listeners
  to fire actions, `change` to react to checked state changes.

## Programmatic control

```ts
menu.focus();                    // focus the menu (or first item if none focused)
menu.focusItem("copy");          // focus a specific item by id
menu.items;                      // → readonly NodeListOf<HTMLElement>
menu.activeItem;                 // → HTMLElement | null
```

## See also

- [`<v-dropdown>`](/ui/dropdown/) — button-triggered menu wrapping this primitive
- [`<v-listbox>`](/ui/listbox/) — selection list with multi-select
- [`<v-popover>`](/ui/popover/) — for positioning menus outside `<v-dropdown>`

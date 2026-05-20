---
title: <v-dropdown>
description: Button-triggered menu with keyboard navigation, focus management, and ARIA roles wired correctly.
---

A trigger button paired with a popover-mounted menu. Composes
`<v-popover>` for positioning, `<v-menu>` for the menu, and handles
the open/close + focus dance between them.

```html
<v-dropdown>
	<button slot="trigger">Actions ▾</button>
	<v-menu>
		<v-menuitem id="archive">Archive</v-menuitem>
		<v-menuitem id="duplicate">Duplicate</v-menuitem>
		<v-menuitem id="delete" disabled>Delete</v-menuitem>
	</v-menu>
</v-dropdown>
```

```ts
import "@vyn/ui/dropdown";

const dropdown = document.querySelector("v-dropdown")!;
dropdown.addEventListener("select", (e) => {
	const { id } = (e as CustomEvent<{ id: string }>).detail;
	// ...
});
```

## Slots

| Slot | What goes in it |
|---|---|
| `trigger` | Any focusable element — typically `<button>`, but `<a>` or `<v-button>` work. Receives `aria-haspopup="menu"` and `aria-expanded`. |
| (default) | A `<v-menu>` containing one or more `<v-menuitem>`s. |

The trigger and the menu are siblings inside the dropdown; the
dropdown handles the wiring between them. You do not pass a separate
`popover` element — the menu IS the popover.

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `open`      | boolean | `false` | Reflects open state. Setting it programmatically opens/closes; users typically toggle via the trigger. |
| `placement` | `"bottom-start" \| "bottom-end" \| "top-start" \| "top-end"` | `"bottom-start"` | Where the menu appears relative to the trigger. |
| `offset`    | number  | `4` | Pixel gap between trigger and menu. |
| `disabled`  | boolean | `false` | Disables the trigger; menu cannot be opened. |

Set attributes via HTML or assign the matching property in JS:

```ts
dropdown.placement = "top-end";
dropdown.offset = 8;
dropdown.disabled = true;
```

## Events

| Event | Detail | When |
|---|---|---|
| `open`   | `{}`            | Menu opened (either by user or programmatically) |
| `close`  | `{}`            | Menu closed |
| `select` | `{ id: string }` | A `<v-menuitem>` was activated by click, Enter, or Space. `id` is the item's `id` attribute. |

`select` bubbles from the menu through the dropdown — listen at the
dropdown level so you don't have to attach handlers per item.

## Keyboard

When the trigger has focus:

| Key | Effect |
|---|---|
| `Space`, `Enter`, `ArrowDown` | Open the menu; focus the first non-disabled item |
| `ArrowUp` | Open the menu; focus the last non-disabled item |

When the menu is open:

| Key | Effect |
|---|---|
| `ArrowDown`, `ArrowUp` | Move focus to next/previous non-disabled item; wraps |
| `Home`, `End`          | First / last non-disabled item |
| `a-z`, `0-9`           | Type-ahead: jump to the next item whose label starts with the typed string |
| `Enter`, `Space`       | Activate the focused item; fires `select`, closes the menu, focus returns to trigger |
| `Esc`                  | Close the menu without selecting; focus returns to trigger |
| `Tab` / `Shift+Tab`    | Close the menu; let the browser advance focus normally |

Type-ahead resets after 500ms of no keystrokes. Holding a letter
repeats cycles through items matching that letter.

## ARIA

The dropdown applies these attributes automatically — you do not set
them.

| Element | Attribute | Value |
|---|---|---|
| trigger | `aria-haspopup` | `"menu"` |
| trigger | `aria-expanded` | `"true"` / `"false"` |
| trigger | `aria-controls` | the menu's id |
| menu    | `role`          | `"menu"` |
| menu    | `id`            | auto-generated if not set |
| menuitem | `role`         | `"menuitem"` |
| menuitem (disabled) | `aria-disabled` | `"true"` |

A `<v-menuitem>` rendered as a checkbox or radio takes
`role="menuitemcheckbox"` / `role="menuitemradio"` automatically.

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-dropdown-bg`         | `Canvas`             | Menu background |
| `--vyn-dropdown-border`     | `1px solid CanvasText` | Menu border |
| `--vyn-dropdown-shadow`     | `0 2px 8px rgba(0,0,0,0.15)` | Menu drop shadow |
| `--vyn-dropdown-radius`     | `4px`                | Menu border radius |
| `--vyn-dropdown-padding`    | `4px 0`              | Menu vertical padding |
| `--vyn-dropdown-item-padding` | `6px 12px`         | Item padding |
| `--vyn-dropdown-item-hover-bg` | `Highlight`       | Hover/focus background |
| `--vyn-dropdown-item-hover-fg` | `HighlightText`   | Hover/focus foreground |
| `--vyn-focus-ring`          | (global)             | Focus ring for trigger and items |

The defaults use system colors so the primitive renders sensibly with
no styling and respects forced-colors mode. Override per-app or
per-instance:

```css
v-dropdown {
	--vyn-dropdown-bg: #1a1a1a;
	--vyn-dropdown-item-hover-bg: #2a2a2a;
}
```

## Accessibility notes

- Focus visibly returns to the trigger when the menu closes. If you
  programmatically remove the trigger before close, focus moves to
  `document.body` and a single `liveRegion("menu closed")`
  announcement fires.
- Type-ahead respects the item's accessible name (the text content
  of `<v-menuitem>`). For items where the visible label differs from
  the spoken label, set `aria-label` explicitly.
- The menu is positioned with `position: fixed` so it escapes
  ancestor `overflow: hidden`. If you need stacking-context aware
  positioning, wrap the dropdown in a `<v-popover>` instead and
  build the menu manually.
- Mobile virtual keyboards: the trigger does not auto-focus on
  mobile to avoid keyboard pop-up. Apps that want auto-focus must
  call `.focus()` themselves.

## Programmatic control

```ts
dropdown.open = true;   // open
dropdown.open = false;  // close
dropdown.toggle();       // flip
```

`open()` / `close()` methods are also available; they're sugar over
the property setter.

## Composing without the dropdown wrapper

If you want a menu that isn't triggered by a button — a context menu,
a command palette, a menu inside a toolbar — use `<v-menu>` directly
and handle positioning yourself. The dropdown is a convenience for
the common "click a button, get a menu" case.

```html
<v-menu id="ctx-menu" hidden>
	<v-menuitem id="copy">Copy</v-menuitem>
	<v-menuitem id="paste">Paste</v-menuitem>
</v-menu>
```

```ts
document.addEventListener("contextmenu", (e) => {
	e.preventDefault();
	const menu = $<HTMLElement>("#ctx-menu");
	position(menu, { x: e.clientX, y: e.clientY });
	menu.hidden = false;
	menu.focus();
});
```

## See also

- [`<v-menu>`](/ui/menu/) — the menu primitive `<v-dropdown>` wraps
- [`<v-popover>`](/ui/popover/) — non-modal positioned overlay
  used internally
- [Components guide](/guide/components/) — how custom elements work
  in Vyn
- [UI primitives overview](/ui/) — the whole `@vyn/ui` set

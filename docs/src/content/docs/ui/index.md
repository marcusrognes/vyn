---
title: UI primitives
description: An optional package of accessible custom elements — dropdowns, menus, dialogs, tables, grids. Native HTML where it exists, ARIA done right where it doesn't. Keyboard-navigable by default.
sidebar:
  order: 8
---

`@vyn/ui` is an optional package of accessible UI primitives —
dropdowns, menus, dialogs, tabs, listboxes, tables, grids — that you
can drop into a Vyn app when you'd rather not write keyboard
navigation and ARIA wiring from scratch. The package is **opt-in**:
nothing in the framework depends on it, and apps that don't import
it don't pay for it.

These are custom elements built the same way [your components are](/guide/components/).
You install the package, import the primitives you want, and use them
in plain HTML. There is no separate runtime, no parallel reactivity
system, no design system.

## Why this exists

Most apps need a handful of widgets that browsers don't ship: a
button-triggered menu, a non-modal popover, an accessible combobox.
Writing them well is hard — keyboard handling, ARIA roles and
states, focus management, screen-reader announcements, RTL, IME.
Writing them poorly is easy and ships in production every day.

Two existing answers:

- **react-aria-components** — comprehensive, battle-tested, deep.
  Costs: React, render-props composition, state machines, a real
  learning curve. Hard to use if you weren't going to use React
  anyway.
- **Roll your own** — fine for the first one. Tenth one is a tax,
  twentieth is a project.

`@vyn/ui` sits between them. It targets the common-case keyboard +
ARIA correctness for a small set of primitives, ships as plain custom
elements, and stays small enough that you can read each primitive's
source if you need to fix something. The trade is depth of edge-case
handling vs. simplicity; if you need flawless RTL + virtual keyboard
+ screen-reader announcement quirks across every primitive, use
react-aria.

## Install

<Tabs syncKey="runtime">
<TabItem label="Deno">

```sh
deno add @vyn/ui
```

```ts
// import the primitives you want anywhere in your client code
import "@vyn/ui/dropdown";
import "@vyn/ui/dialog";
```

</TabItem>
<TabItem label="Node">

```sh
npm add @vyn/ui
```

```ts
import "@vyn/ui/dropdown";
import "@vyn/ui/dialog";
```

</TabItem>
</Tabs>

import { Tabs, TabItem } from '@astrojs/starlight/components';

Each subpath import registers one custom element. The bundle includes
only what you import.

## Usage

A dropdown menu that posts to your action registry:

```html
<v-dropdown id="menu">
	<button slot="trigger">Actions ▾</button>
	<v-menu>
		<v-menuitem id="archive">Archive</v-menuitem>
		<v-menuitem id="duplicate">Duplicate</v-menuitem>
		<v-menuitem id="delete" disabled>Delete</v-menuitem>
	</v-menu>
</v-dropdown>
```

```ts
const menu = $<HTMLElement>("#menu");
menu.addEventListener("select", async (e: Event) => {
	const id = (e as CustomEvent<{ id: string }>).detail.id;
	if (id === "archive")   await rpc.notes.archive.mutate({ _id });
	if (id === "duplicate") await rpc.notes.duplicate.mutate({ _id });
});
```

What the dropdown handles for you:

- Toggles open/closed on click, Enter, or Space.
- Arrow keys move focus through items; type-ahead jumps by letter.
- Esc closes and restores focus to the trigger.
- Tab moves focus out of the menu, closing it.
- `aria-haspopup` and `aria-expanded` on the trigger; `role="menu"` on
  the panel; `role="menuitem"` on items; `disabled` is `aria-disabled`.
- Click outside closes.
- Focus visibly returns to the trigger on close.

You write the markup; the primitive does the rest.

## Two layers

`@vyn/ui` ships at two levels of abstraction. Use whichever fits the
situation; you can mix freely in the same app.

### Behaviors (data-attribute modules)

Small modules that scan the document for elements with specific
`data-*` attributes and wire keyboard / selection / positioning onto
them. No custom element required — apply attributes to plain HTML,
import the behavior module once, the behavior turns on.

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
```

That's a fully keyboard-navigable single-select list. No
`<v-listbox>` registration, no `createApp`, no JSX. The behavior
modules cover the bulk of UI work:

| Module | Behavior |
|---|---|
| [`@vyn/ui/keyboard-nav`](/ui/keyboard-nav/) | Arrow keys, type-ahead, roving tabindex |
| [`@vyn/ui/select`](/ui/select/)             | Single or multi selection state via `data-value`; `aria-selected` |
| `@vyn/ui/popover`        | Anchored positioning + open/close via `data-popover` |
| `@vyn/ui/focus-trap`     | Trap focus inside a modal |
| `@vyn/ui/live`           | `aria-live` announcements |
| `@vyn/ui/edit`           | Inline-editable cells |
| `@vyn/ui/sort`           | Column-header sort buttons |

Each behavior is ~50-150 LOC. The whole behavior set is small enough
to read end-to-end.

### Widgets (prebuilt custom elements)

For the common compositions, the package ships prebuilt custom
elements that bundle behaviors with sensible defaults, role wiring,
and tested edge cases. You don't have to choose — use the widget for
the common case, drop down to behaviors when the widget doesn't fit.

| Widget | Composes |
|---|---|
| [`<v-menu>`](/ui/menu/)         | keyboard-nav + activate |
| [`<v-dropdown>`](/ui/dropdown/) | menu + popover + button trigger |
| [`<v-listbox>`](/ui/listbox/)   | keyboard-nav + select |
| [`<v-combobox>`](/ui/combobox/) | keyboard-nav + select + popover + input |
| [`<v-tabs>`](/ui/tabs/)         | keyboard-nav + select (orientation-aware) |
| [`<v-table>`](/ui/table/)       | keyboard-nav + select + sort |
| [`<v-grid>`](/ui/grid/)         | keyboard-nav + select + edit + sort |
| [`<v-dialog>`](/ui/dialog/)     | focus-trap + native `<dialog>` |
| [`<v-popover>`](/ui/popover/)   | popover behavior + dismiss handling |

The widgets emit the right `data-*` attributes internally and import
the behaviors they need. Reading a widget's source is the easiest way
to learn the behavior pattern.

## The widget set

Each widget is one custom element (plus a few sub-elements where the
ARIA spec calls for it). Click through for the per-widget reference.

### Form controls

| Element | Role | Native equivalent |
|---|---|---|
| [`<v-button>`](/ui/button/) | activation | `<button>` (with extra states like `loading`, `pressed`) |
| [`<v-toggle>`](/ui/toggle/) | switch | `<input type=checkbox>` styled as switch |
| [`<v-radio-group>`](/ui/radio-group/) | radio group | `<input type=radio>` set with roving tabindex |
| [`<v-checkbox>`](/ui/checkbox/) | checkbox | `<input type=checkbox>` with tri-state |

### Disclosure and overlays

| Element | Role | Notes |
|---|---|---|
| [`<v-popover>`](/ui/popover/) | non-modal positioned overlay | anchored to a trigger; Esc dismisses |
| [`<v-dialog>`](/ui/dialog/) | modal | wraps `<dialog>`; focus trap; Esc dismisses |
| [`<v-tooltip>`](/ui/tooltip/) | tooltip | hover + focus; Esc dismiss |
| [`<v-disclosure>`](/ui/disclosure/) | summary/content | wraps `<details>` with animation hooks |

### Lists and selection

| Element | Role | Notes |
|---|---|---|
| [`<v-menu>`](/ui/menu/) | menu | arrow nav, type-ahead, Esc closes |
| [`<v-dropdown>`](/ui/dropdown/) | trigger + menu | composes button + menu with positioning |
| [`<v-listbox>`](/ui/listbox/) | listbox | single or multi-select, type-ahead |
| [`<v-combobox>`](/ui/combobox/) | combobox | input + filterable listbox |

### Structure and layout

| Element | Role | Notes |
|---|---|---|
| [`<v-tabs>`](/ui/tabs/) | tabs + panels | arrow nav, automatic or manual activation |
| [`<v-table>`](/ui/table/) | sortable data table | wraps `<table>` with keyboard cell nav and sort |
| [`<v-grid>`](/ui/grid/) | data grid | divs with `role="grid"`, full keyboard nav |
| [`<v-toast>`](/ui/toast/) | live region notifications | `aria-live`, auto-dismiss |

## Styling

`@vyn/ui` ships zero opinions about visual design. Each primitive
defines a small set of CSS custom properties for the parts that need
to coordinate — focus rings, layering, transitions — and leaves
everything else to your stylesheet.

```css
/* Globally tweak the focus ring for every primitive */
:root {
	--vyn-focus-ring: 2px solid blue;
	--vyn-focus-offset: 2px;
}

/* Or scope it to one primitive */
v-menu {
	--vyn-menu-bg: #1a1a1a;
	--vyn-menu-border: 1px solid #333;
}
```

Each primitive's reference page lists every custom property it
honors. The bare-bones output is unstyled lists, buttons, and dialogs;
add your own CSS to make it look like your app.

## Accessibility

Each primitive ships with a documented keyboard table and a list of
ARIA roles/states it manages. The package is tested against:

- **Keyboard:** every interactive primitive is fully operable without
  a mouse, with no surprises on Tab order.
- **Screen readers:** VoiceOver (macOS), NVDA (Windows), Orca (Linux).
  The CI matrix runs each primitive through a recorded SR session and
  diffs the announcements.
- **High contrast and forced colors:** primitives don't disappear in
  Windows High Contrast mode or `prefers-contrast: more`.
- **Reduced motion:** transitions respect `prefers-reduced-motion`.

This is a real ongoing investment. The package documents its known
gaps in each primitive's "Accessibility notes" section so you can
make an informed call.

## Composing your own

`@vyn/ui` is not a closed set. If you want a primitive it doesn't
ship, write your own using the same framework helpers the package
uses internally — they're exported from `@vyn/client`:

| Helper | What it does |
|---|---|
| `trapFocus(el)`       | Constrains focus to `el` while active; returns a teardown fn |
| `restoreFocusOn(el)`  | Saves the currently-focused element; restores it when `el` disconnects |
| `rovingTabIndex(items)` | One-tab-stop list with arrow-key navigation |
| `typeahead(items, getLabel)` | Letter-key jumping for menus/listboxes |
| `position(target, anchor, opts)` | Floating UI-style positioning for popovers |
| `liveRegion(message, level)` | Announce a string via an off-screen `aria-live` region |

These are the same helpers `@vyn/ui` uses; the package is not
magic. Read the source of any primitive — each one is ~100 LOC of
custom element + helpers.

## What's not in the box

By design, `@vyn/ui` does not include:

- **Layout primitives.** `<Container>`, `<Stack>`, `<Grid>` (CSS
  layout, not data grid) — these are just flexbox/grid and don't
  benefit from a primitive. Write the CSS.
- **Iconography.** Pick an icon set you like and `<svg>` it. The
  primitives don't bundle icons; they accept any element you slot
  in.
- **A theme.** No light/dark switcher, no color tokens, no spacing
  scale. Apps already have these or pick a CSS framework. The
  primitives use CSS custom properties so any theme can coordinate.
- **Animation library.** `<v-dialog>` and `<v-popover>` expose
  transition hooks (`v-state="opening"`, `"closing"`, etc.) so your
  CSS can animate. No JS animation runtime.

## Open questions

- **Form integration.** Form primitives currently expose values via
  `el.value` and emit `change` events, matching native inputs.
  Whether to ship a higher-level `<v-form>` that integrates with
  `v.*` validators for inline error display is open.
- **Data binding.** Listbox/table/combobox primitives take items via
  property assignment (`el.items = ...`) and an optional
  `getLabel` / `getKey` config. Whether to ship a "render-item"
  pattern beyond that is open.
- **Virtualization.** For large lists, `<v-listbox>` and `<v-table>`
  do not virtualize by default. A `<v-virtual-list>` primitive may
  land later; rendering 10k rows is a real-world need.

## See also

- [Components](/guide/components/) — write your own custom elements
- [`@vyn/ui` reference](/ui/) — every primitive, every prop,
  every event, every key

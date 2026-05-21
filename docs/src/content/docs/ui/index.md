---
title: UI primitives
description: An optional package of accessible UI behaviors and a few prebuilt widgets. Apply data-attributes to plain HTML; the framework wires keyboard, selection, positioning, and ARIA.
sidebar:
  order: 1
---

:::tip
**Live interactive examples land with the package.** This doc currently
shows code; once `@vyn/ui` ships, each behavior and widget page gains a
`<LiveExample>` block that renders the actual element inline — read the
HTML, see the keyboard work in real time, watch the events fire, copy
the source. Until then, examples are reference-only.
:::

`@vyn/ui` is an optional package that makes accessible UI primitives —
keyboard navigation, selection, positioning, focus trapping — work
across any HTML you write. The package is **opt-in**: nothing in the
framework depends on it, and apps that don't import it don't pay for
it.

The package ships at two layers. **Behaviors** are small modules that
apply functionality to any HTML via `data-*` attributes. **Widgets**
are a handful of custom elements that bundle behaviors with internal
state for cases where the data-attribute approach can't reach.

You'll mostly use behaviors. Widgets exist where they genuinely earn
their keep.

## Behaviors

Each behavior is a single module that scans for elements with a
matching `data-*` attribute, wires the relevant keyboard / focus /
ARIA logic onto them, and watches the DOM for additions. Import the
module once; the behavior turns on everywhere.

```html
<ul role="listbox" data-keyboard-nav data-select="single" data-value="editor">
	<li role="option" data-value="admin">Admin</li>
	<li role="option" data-value="editor">Editor</li>
	<li role="option" data-value="viewer">Viewer</li>
</ul>
```

```ts
import "@vyn/ui/keyboard-nav";
import "@vyn/ui/select";

document.querySelector("ul")!.addEventListener("change", (e) => {
	const { value } = (e as CustomEvent<{ value: string }>).detail;
	// ...
});
```

That's a fully keyboard-operable single-select listbox with
`aria-selected` wiring. No custom element, no compile step, no
framework runtime to think about.

### The behavior set

| Module | Behavior | Composes via |
|---|---|---|
| [`@vyn/ui/keyboard-nav`](/vyn/ui/keyboard-nav/)        | Arrow keys, Home/End, roving tabindex                          | `data-keyboard-nav` |
| [`@vyn/ui/typeahead`](/vyn/ui/typeahead/)              | Letter-key buffer + jump                                       | `data-typeahead` |
| [`@vyn/ui/select`](/vyn/ui/select/)                    | Single/multi selection state via `data-value`; `aria-selected` | `data-select` |
| [`@vyn/ui/popover`](/vyn/ui/popover/)                  | Anchored positioning + open/close                              | `data-popover` |
| [`@vyn/ui/anchor`](/vyn/ui/anchor/)                    | Position one element relative to another (flip, offset)        | `data-anchor` |
| [`@vyn/ui/dismiss`](/vyn/ui/dismiss/)                  | Esc + outside click + focus-out → `dismiss` event              | `data-dismiss` |
| [`@vyn/ui/focus-trap`](/vyn/ui/focus-trap/)            | Contain Tab focus inside an element                            | `data-focus-trap` |
| [`@vyn/ui/aria-describedby`](/vyn/ui/aria-describedby/) | Wire `aria-describedby` between two elements                  | `data-describes` |
| [`@vyn/ui/tooltip`](/vyn/ui/tooltip/)                  | Hover/focus + describedby; composes anchor + dismiss + describedby | `data-tooltip` |
| [`@vyn/ui/form-associated`](/vyn/ui/form-associated/)  | Custom value-holders participate in `<form>` submission         | `data-form-name` |
| [`@vyn/ui/live`](/vyn/ui/live/)                        | `aria-live` region for ad-hoc announcements                    | `liveRegion(message)` helper |
| [`@vyn/ui/sort`](/vyn/ui/sort/)                        | Column-header sort buttons with `aria-sort`                    | `data-sort-key` |
| [`@vyn/ui/edit`](/vyn/ui/edit/)                        | Inline-editable cells (Enter to edit, Esc to cancel, Enter/Tab to commit) | `data-editable` |
| [`@vyn/ui/sortable`](/vyn/ui/sortable/)                | Drag to reorder a list; emits `reorder`                         | `data-sortable` |
| [`@vyn/ui/drag-drop`](/vyn/ui/drag-drop/)              | Cross-container drag-and-drop with keyboard fallback           | `data-drag` / `data-drop` |
| [`@vyn/ui/auto-resize`](/vyn/ui/auto-resize/)          | `<textarea>` grows with content                                | `data-auto-resize` |
| [`@vyn/ui/copy`](/vyn/ui/copy/)                        | Button copies a target's text to clipboard with feedback        | `data-copy` |
| [`@vyn/ui/scroll-into-view`](/vyn/ui/scroll-into-view/) | Scroll element into view on focus or attribute change          | `data-scroll-into-view` |

Each behavior is ~50-150 LOC. The whole set fits in one mental model:
a few hundred lines that turn HTML into accessible UI.

### Composing behaviors

Most UI patterns are a stack of behaviors on the same element:

```html
<!-- a dropdown menu -->
<button data-anchor="role-menu-trigger" aria-haspopup="menu">Role ▾</button>

<ul id="role-menu" role="menu"
    data-popover data-anchor-of="role-menu-trigger"
    data-dismiss data-keyboard-nav data-typeahead>
	<li role="menuitem" data-key="admin">Admin</li>
	<li role="menuitem" data-key="editor">Editor</li>
	<li role="menuitem" data-key="viewer">Viewer</li>
</ul>
```

```ts
import "@vyn/ui/popover";
import "@vyn/ui/dismiss";
import "@vyn/ui/keyboard-nav";
import "@vyn/ui/typeahead";

document.querySelector("ul")!.addEventListener("activate", (e) => {
	const { key } = (e as CustomEvent<{ key: string }>).detail;
	// ...
});
```

That is a complete accessible dropdown menu: keyboard navigation,
type-ahead, ARIA, click-outside-to-dismiss, Esc-to-dismiss, anchored
positioning. No custom element registration, no JSX, no compile step.

## Widgets

For four specific cases, a custom element earns its keep — the
state, virtual focus, queue, or data-driven rendering is too tangled
to express purely through data-attributes. These ship as
`@vyn/ui/<widget>` subpaths.

| Widget | What it adds | Why a custom element |
|---|---|---|
| [`<v-grid>`](/vyn/ui/grid/)       | Data-driven cell rendering, range select, inline edit                  | Cell rendering and range selection model want encapsulated state |
| [`<v-table>`](/vyn/ui/table/)     | Data-driven `<table>` with sort and row select                          | Same as grid but read-mostly and based on native `<table>` |
| [`<v-combobox>`](/vyn/ui/combobox/) | Input + listbox with `aria-activedescendant` (input keeps focus)     | The virtual-focus pattern is materially different from roving tabindex |
| [`<v-toaster>`](/vyn/ui/toast/)    | Queue, position stacking, dedup, route-survival                        | Queue management needs encapsulated state |

Everything else that used to be a widget — menus, dropdowns,
listboxes, dialogs, popovers, tooltips, tabs, buttons, switches,
checkboxes, radios, disclosure — is now plain HTML plus
data-attributes. Reach for the prebuilt widget for the cases above;
write the markup yourself for everything else.

## Styling

`@vyn/ui` ships zero opinions about visual design. Behaviors set
ARIA and `data-state="..."` attributes; widgets expose CSS custom
properties for the parts that need to coordinate (focus rings,
overlays, transitions). Everything else is your stylesheet.

```css
/* Global focus ring */
:root {
	--vyn-focus-ring: 2px solid CanvasText;
	--vyn-focus-offset: 2px;
}

/* Style a selected option */
[data-select] [aria-selected="true"] {
	background: Highlight;
	color: HighlightText;
}

/* Animate the open state of a popover */
[data-popover][data-state="opening"] {
	animation: fade-in 150ms;
}
```

The defaults use system colors so the primitives render sensibly in
forced-colors mode and dark mode without theming.

## Accessibility

Each behavior + widget is tested against:

- **Keyboard:** every interactive primitive is operable without a mouse.
- **Screen readers:** VoiceOver, NVDA, Orca, all on the latest stable
  browsers in CI.
- **High contrast / forced colors:** primitives don't disappear.
- **Reduced motion:** transitions respect `prefers-reduced-motion`.

The behavior reference pages document keyboard tables, ARIA roles
and states, and known accessibility gaps in their open-questions
section.

## Composing your own

If a behavior is missing, write it. The same helpers `@vyn/ui` uses
internally are exported from `@vyn/client`:

| Helper | What it does |
|---|---|
| `trapFocus(el)`           | Constrains focus to `el`; returns a teardown fn |
| `restoreFocusOn(el)`      | Saves currently-focused element; restores when `el` disconnects |
| `rovingTabIndex(items)`   | One-tab-stop list with arrow-key navigation |
| `typeahead(items, getLabel)` | Letter-key jumping for menus / listboxes |
| `position(target, anchor, opts)` | Floating-UI-style positioning |
| `liveRegion(message, level?)` | Announce via an off-screen `aria-live` region |
| `observe(selector, fn)`   | Run `fn` for every existing and future element matching `selector` — the discovery hook every behavior uses |

The behavior modules themselves are the best examples of how to
compose these — read any of their sources to write your own.

## What's not in the box

- **Layout primitives.** `<Stack>`, `<Grid>` (CSS layout) — these are
  just flexbox/grid CSS and don't benefit from a primitive.
- **Iconography.** Pick an icon set and `<svg>` it.
- **Themes.** No light/dark switcher, no color tokens. Use the system
  colors the primitives default to, or override the CSS custom
  properties.
- **Animation runtime.** Primitives expose `data-state="opening"` /
  `"closing"` so your CSS can animate; no JS animation library.

## See also

- [Components](/vyn/guide/components/) — write your own custom elements
  when you need them
- The behavior reference pages above, each linked from the table

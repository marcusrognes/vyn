---
title: <v-tabs>
description: A tabs widget with arrow-key navigation, automatic or manual activation modes, and proper ARIA wiring for the tablist/tab/tabpanel pattern.
---

A tablist with associated tab panels. Arrow keys move focus between
tabs; Enter/Space activates. Choose **automatic** activation (focus
implies show) or **manual** (focus moves freely, Enter shows) based
on whether activating a tab is cheap or has side effects.

```html
<v-tabs id="settings" activation="manual">
	<v-tab id="profile">Profile</v-tab>
	<v-tab id="account">Account</v-tab>
	<v-tab id="billing" disabled>Billing</v-tab>

	<v-panel for="profile">…profile fields…</v-panel>
	<v-panel for="account">…account fields…</v-panel>
	<v-panel for="billing">…billing fields…</v-panel>
</v-tabs>
```

```ts
import "@vyn/ui/tabs";

document.querySelector("v-tabs")!.addEventListener("change", (e) => {
	const { id } = (e as CustomEvent<{ id: string }>).detail;
	// ...
});
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | A flat list of `<v-tab>` elements followed by `<v-panel>` elements. Order does not matter for binding (panels match by `for` ↔ `id`); order matters for arrow-key navigation between tabs |

## Attributes (on `<v-tabs>`)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `activation` | `"automatic" \| "manual"` | `"automatic"` | Whether arrow-key focus immediately activates the tab (`automatic`) or requires Enter/Space (`manual`) |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Affects which arrow keys navigate (Left/Right vs Up/Down) and the ARIA orientation |
| `value` | string | first non-disabled tab id | id of the currently active tab. Set to programmatically switch |
| `loop` | boolean | `true` | Whether arrow keys wrap at the ends |

## Attributes (on `<v-tab>`)

| Attribute | Type | What it does |
|---|---|---|
| `id`       | string  | Stable id; matched against `<v-panel for="...">` |
| `disabled` | boolean | Skipped in arrow nav; non-focusable; `aria-disabled="true"` |

## Attributes (on `<v-panel>`)

| Attribute | Type | What it does |
|---|---|---|
| `for` | string | id of the tab that controls this panel |

## Events

| Event | Detail | When |
|---|---|---|
| `change` | `{ id: string, previous: string \| null }` | Active tab changed (focus-then-activate in automatic, Enter/Space in manual) |

## Keyboard

When a tab has focus:

| Key | Effect (horizontal) | Effect (vertical) |
|---|---|---|
| `ArrowRight` | Next non-disabled tab | (no-op) |
| `ArrowLeft`  | Previous non-disabled tab | (no-op) |
| `ArrowDown`  | (no-op) | Next non-disabled tab |
| `ArrowUp`    | (no-op) | Previous non-disabled tab |
| `Home`       | First non-disabled tab | First non-disabled tab |
| `End`        | Last non-disabled tab | Last non-disabled tab |
| `Enter`, `Space` | Activate (only meaningful in `manual` mode) | Activate |
| `Tab`        | Move focus into the active panel (out of the tablist) | Same |

In `automatic` mode, focus implies activation — arrow keys both
move focus and switch panels. In `manual` mode, the active tab does
not change until Enter or Space.

## ARIA

| Element | Attribute | Value |
|---|---|---|
| `<v-tabs>`   | `role`                | `"tablist"` (delegated to inner element if shadow DOM used) |
| `<v-tabs>`   | `aria-orientation`    | from `orientation` attribute |
| `<v-tab>`    | `role`                | `"tab"` |
| `<v-tab>`    | `aria-selected`       | `"true"` on the active tab |
| `<v-tab>`    | `aria-controls`       | id of the matching `<v-panel>` |
| `<v-tab>`    | `tabindex`            | `0` on active, `-1` on others (roving tabindex) |
| `<v-tab>`    | `aria-disabled`       | `"true"` when disabled |
| `<v-panel>`  | `role`                | `"tabpanel"` |
| `<v-panel>`  | `aria-labelledby`     | id of the matching `<v-tab>` |
| `<v-panel>`  | `tabindex`            | `0` (so users can Tab into the panel) |
| `<v-panel>`  | `hidden`              | reflected on inactive panels |

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-tabs-border`         | `1px solid CanvasText` | Tablist underline (horizontal) or side border (vertical) |
| `--vyn-tab-padding`         | `0.5em 1em`         | Per-tab padding |
| `--vyn-tab-fg`              | `CanvasText`        | Inactive tab foreground |
| `--vyn-tab-active-fg`       | `Highlight`         | Active tab foreground |
| `--vyn-tab-active-indicator`| `2px solid Highlight` | Active tab underline (horizontal) / side bar (vertical) |
| `--vyn-tab-hover-bg`        | `transparent`       | Hover background |
| `--vyn-tab-disabled-fg`     | `GrayText`          | Disabled tab color |
| `--vyn-tabs-gap`            | `0`                 | Gap between tabs |

## Accessibility notes

- Pick `manual` activation when changing a tab is expensive (loads
  remote data, scrolls a long list). Pick `automatic` when tabs
  represent equally-cheap views — automatic is friendlier for
  screen-reader users because they hear panel content on arrow.
- Disabled tabs are skipped in arrow navigation entirely. They
  remain visible but unreachable; `aria-disabled` is set, not the
  native disabled attribute (which doesn't exist on non-form
  elements).
- The active panel is focusable via Tab. From the panel, Shift+Tab
  returns focus to the tablist.

## Programmatic control

```ts
tabs.value = "account";          // switch tabs
tabs.tabs;                       // → readonly array of <v-tab> elements
tabs.activeTab;                  // → <v-tab> | null
tabs.focusTab("billing");        // move focus to a tab without activating (manual mode)
```

## See also

- [`<v-listbox>`](/ui/listbox/) — for selecting one of many at once
- [`<v-menu>`](/ui/menu/) — for command-style choices
- [Components guide](/guide/components/) — for writing your own

---
title: <v-radio-group>
description: A group of radio inputs with roving tabindex and arrow-key navigation. One tab stop for the whole group.
---

A group of radios with the W3C radio-group pattern: the whole group
is one Tab stop, arrow keys move between options. Form-associated;
submits the selected value as a single field.

```html
<v-radio-group name="plan" value="pro">
	<v-radio value="free">Free</v-radio>
	<v-radio value="pro">Pro</v-radio>
	<v-radio value="team">Team</v-radio>
	<v-radio value="enterprise" disabled>Enterprise (contact sales)</v-radio>
</v-radio-group>
```

```ts
import "@vyn/ui/radio-group";

document.querySelector("v-radio-group")!.addEventListener("change", (e) => {
	const value = (e.target as HTMLElement & { value: string }).value;
	// ...
});
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | `<v-radio>` elements |

## Attributes (on `<v-radio-group>`)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `name`        | string  | unset    | Form field name |
| `value`       | string  | unset    | Currently selected radio's value; two-way |
| `orientation` | `"horizontal" \| "vertical"` | `"vertical"` | Arrow-key axis |
| `disabled`    | boolean | `false` | Disables every radio |
| `required`    | boolean | `false` | Native form validity (group has no selection) |

## Attributes (on `<v-radio>`)

| Attribute | Type | What it does |
|---|---|---|
| `value`    | string  | Submitted value when this radio is selected |
| `disabled` | boolean | Disable this radio individually |

## Events

| Event | Detail | When |
|---|---|---|
| `change` | `{}` (read `.value` on the group) | Selection changed |

## Keyboard

When a radio in the group has focus:

| Key | Effect (vertical) | Effect (horizontal) |
|---|---|---|
| `ArrowDown`, `ArrowUp` | Next / previous radio; wraps | (no-op) |
| `ArrowRight`, `ArrowLeft` | (no-op) | Next / previous radio; wraps |
| `Space` | (no-op; arrow already selected the focused radio) | same |
| `Tab` | Move focus out of the group | same |

Per the W3C pattern, **arrow keys both move focus and select** —
the selected radio is always the one with focus. Use a different
primitive (like [`<v-listbox>`](/ui/listbox/)) if you need
focus-without-select.

## ARIA

| Element | Attribute | Value |
|---|---|---|
| `<v-radio-group>` | `role`              | `"radiogroup"` |
| `<v-radio-group>` | `aria-orientation`  | from attribute |
| `<v-radio>`       | `role`              | `"radio"` |
| `<v-radio>`       | `aria-checked`      | `"true"` on selected |
| `<v-radio>`       | `tabindex`          | `0` on selected (or first non-disabled if none), `-1` on others |
| `<v-radio>`       | `aria-disabled`     | when disabled |

If the group has no visible label, set `aria-label` or
`aria-labelledby` on `<v-radio-group>`.

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-radio-size`         | `1em`                | Circle dimensions |
| `--vyn-radio-bg`           | `Field`              | Unchecked background |
| `--vyn-radio-border`       | `1px solid FieldText` | Border |
| `--vyn-radio-bg-checked`   | `Highlight`          | Checked background |
| `--vyn-radio-dot`          | `HighlightText`      | Inner dot color |
| `--vyn-radio-focus-ring`   | (global)             | Focus ring |

## Accessibility notes

- The whole group is one Tab stop. Tabbing in lands on the selected
  radio (or the first non-disabled if nothing is selected); from
  there arrows move between options.
- Selection follows focus by design — there is no "I want to move
  focus without changing the answer" pattern in a radio group. For
  that, use a [`<v-listbox>`](/ui/listbox/) in single-select mode.
- A disabled radio is skipped in arrow-key navigation. A
  `disabled` group disables all members and removes them from the
  Tab order entirely.

## Programmatic control

```ts
group.value = "team";
group.radios;                    // → readonly array of <v-radio> elements
```

## See also

- [`<v-checkbox>`](/ui/checkbox/) — boolean / tri-state
- [`<v-listbox>`](/ui/listbox/) — selection list with focus-without-select option
- [`<v-toggle>`](/ui/toggle/) — switch-styled boolean

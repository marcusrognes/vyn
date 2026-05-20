---
title: <v-checkbox>
description: A form-associated checkbox with full tri-state (checked / unchecked / indeterminate) and a stylable rendering.
---

A checkbox. Form-associated, keyboard-operable, supports the
indeterminate state for "some children checked" scenarios. Use it
for multi-select forms, "I agree" terms, and parent-of-many
checkbox patterns.

For boolean on/off settings where a switch visual reads better, use
[`<v-toggle>`](/ui/toggle/) instead.

```html
<v-checkbox name="agree" required>I agree to the terms</v-checkbox>

<v-checkbox id="all">All</v-checkbox>
<v-checkbox name="cats" value="a">Cats</v-checkbox>
<v-checkbox name="cats" value="b">Dogs</v-checkbox>
<v-checkbox name="cats" value="c">Fish</v-checkbox>
```

```ts
import "@vyn/ui/checkbox";

const all = document.querySelector<HTMLElement & { indeterminate: boolean; checked: boolean }>("#all")!;
const children = document.querySelectorAll<HTMLElement & { checked: boolean }>("v-checkbox[name=cats]");

function syncAll() {
	const checkedCount = [...children].filter(c => c.checked).length;
	all.checked = checkedCount === children.length;
	all.indeterminate = checkedCount > 0 && checkedCount < children.length;
}
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | The visible label. Clicking it toggles |

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `checked`        | boolean | `false` | Checked state; reflects |
| `indeterminate`  | boolean | `false` | Indeterminate state; reflects; cleared on user toggle |
| `disabled`       | boolean | `false` | Disables interaction |
| `name`           | string  | unset    | Form field name |
| `value`          | string  | `"on"`   | Submitted value when checked |
| `required`       | boolean | `false` | Native form validity |

## Events

| Event | Detail | When |
|---|---|---|
| `change` | `{}` (read `.checked` and `.indeterminate`) | State changed |

## Keyboard

| Key | Effect |
|---|---|
| `Space` | Toggle checked. If currently indeterminate, becomes checked |

## ARIA

| Attribute | Value |
|---|---|
| `role`         | `"checkbox"` |
| `aria-checked` | `"true"` / `"false"` / `"mixed"` (when indeterminate) |
| `aria-disabled` | when disabled |
| `aria-required` | when required |

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-checkbox-size`         | `1em`                | Box dimensions |
| `--vyn-checkbox-bg`           | `Field`              | Unchecked background |
| `--vyn-checkbox-border`       | `1px solid FieldText` | Border |
| `--vyn-checkbox-radius`       | `2px`                | Corner radius |
| `--vyn-checkbox-bg-checked`   | `Highlight`          | Checked background |
| `--vyn-checkbox-fg-checked`   | `HighlightText`      | Checkmark color |
| `--vyn-checkbox-focus-ring`   | (global)             | Focus ring |

## Accessibility notes

- The indeterminate state is purely visual + ARIA — it does not
  affect form submission. A indeterminate checkbox submits as
  unchecked. Set `checked` explicitly if you want it to submit.
- `aria-checked="mixed"` is the right value for indeterminate;
  screen readers announce "partially checked."
- For a list of related checkboxes, a wrapping `<fieldset>` with a
  `<legend>` is the right accessible grouping — `<v-checkbox>`
  doesn't ship a group element because the native pattern works.

## Programmatic control

```ts
checkbox.checked = true;
checkbox.indeterminate = true;     // visual + ARIA only
checkbox.focus();
```

## See also

- [`<v-toggle>`](/ui/toggle/) — switch-styled boolean
- [`<v-radio-group>`](/ui/radio-group/) — one-of-many selection

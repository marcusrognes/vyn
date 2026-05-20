---
title: <v-toggle>
description: A switch — the on/off control. Visually a slider, semantically a checkbox. Form-associated and keyboard-operable.
---

A switch control: a styled, form-associated checkbox that renders as
a slider. Use it for boolean settings where the visual affordance of
"on/off" reads better than a checkbox — notification toggles, dark
mode, feature flags in admin UIs.

```html
<v-toggle name="notifications" id="notif">Email notifications</v-toggle>
<v-toggle name="newsletter" id="news" checked>Subscribed</v-toggle>
<v-toggle id="dark" aria-label="Dark mode"></v-toggle>
```

```ts
import "@vyn/ui/toggle";

document.querySelector("v-toggle")!.addEventListener("change", (e) => {
	const checked = (e.target as HTMLElement & { checked: boolean }).checked;
	// ...
});
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | The visible label. Click activates the toggle |

For icon-only toggles, omit the slot and set `aria-label`.

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `checked`  | boolean | `false` | On/off state; reflects |
| `disabled` | boolean | `false` | Disables interaction |
| `name`     | string  | unset    | Form field name |
| `value`    | string  | `"on"`   | Submitted value when checked |
| `required` | boolean | `false` | Native form validity |

`<v-toggle>` is **form-associated** — it submits with surrounding
`<form>` elements like a native checkbox would.

## Events

| Event | Detail | When |
|---|---|---|
| `change` | `{}` (read `.checked` on the element) | State changed |
| `input`  | `{}` | Same as change; fires before form validity update |

## Keyboard

| Key | Effect |
|---|---|
| `Space` | Toggle |
| `Tab` / `Shift+Tab` | Move focus |

## ARIA

| Attribute | Value |
|---|---|
| `role` | `"switch"` |
| `aria-checked` | `"true"` / `"false"` |
| `aria-disabled` | when disabled |

The element uses `role="switch"` (not `role="checkbox"`) so screen
readers announce "On" / "Off" rather than "checked" / "not checked".
For a tri-state checkbox, use [`<v-checkbox>`](/ui/checkbox/) instead.

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-toggle-track-bg`      | `GrayText`           | Off track background |
| `--vyn-toggle-track-bg-on`   | `Highlight`          | On track background |
| `--vyn-toggle-thumb-bg`      | `Canvas`             | Thumb background |
| `--vyn-toggle-thumb-shadow`  | `0 1px 2px rgba(0,0,0,0.2)` | Thumb shadow |
| `--vyn-toggle-width`         | `2.5em`              | Track width |
| `--vyn-toggle-height`        | `1.4em`              | Track height |
| `--vyn-toggle-thumb-size`    | `1.2em`              | Thumb diameter |
| `--vyn-toggle-focus-ring`    | (global)             | Focus ring on track |

## Accessibility notes

- `role="switch"` is announced as "on"/"off" by screen readers.
  For a checkbox (with native indeterminate state and the "I'm
  unsure" semantics), use [`<v-checkbox>`](/ui/checkbox/).
- The toggle is form-associated. Inside a `<form>`, it participates
  in submission, validation, and `formdata` events.
- Reduced motion: the thumb transition is suppressed under
  `prefers-reduced-motion: reduce`.

## Programmatic control

```ts
toggle.checked = true;          // turn on
toggle.checked = !toggle.checked;   // flip
toggle.focus();
```

## See also

- [`<v-checkbox>`](/ui/checkbox/) — for tri-state checkboxes
- [`<v-radio-group>`](/ui/radio-group/) — for one-of-many selections

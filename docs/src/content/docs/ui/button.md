---
title: <v-button>
description: A native button with extra states the platform doesn't ship — loading, pressed, and selection-style variants — and the same a11y guarantees.
---

A thin wrapper around `<button>` that adds the common UI states the
platform doesn't ship (`loading`, `pressed`) while leaving everything
the native element does well alone — keyboard, form association, the
default tab order, the implicit `role="button"`.

Use it where you'd reach for a custom-styled button and want the
extra states without re-inventing focus, disabled handling, or form
submission.

```html
<v-button>Save</v-button>
<v-button variant="primary">Continue</v-button>
<v-button loading>Saving…</v-button>
<v-button pressed>Bold</v-button>
<v-button disabled>Cannot</v-button>
```

```ts
import "@vyn/ui/button";

document.querySelector("v-button")!.addEventListener("click", () => /* ... */);
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | The label — text, or an `<svg>` + text, or an icon-only element |
| `loading` | Replaces the default slot while `loading` is true. Defaults to a built-in spinner if omitted |

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `variant`   | `"default" \| "primary" \| "danger" \| "ghost"` | `"default"` | Pick a built-in visual variant |
| `size`      | `"sm" \| "md" \| "lg"` | `"md"` | Sizing token; affects padding + font size via CSS vars |
| `loading`   | boolean | `false` | Shows the `loading` slot (or default spinner) and sets `aria-busy="true"`; clicks are suppressed |
| `pressed`   | boolean | unset   | Toggle-button mode. When set, sets `aria-pressed`; clicking flips the value and fires `change` |
| `disabled`  | boolean | `false` | Native disabled — no focus, no click, no form submission |
| `type`      | `"button" \| "submit" \| "reset"` | `"button"` | Inherited from the underlying `<button>`; default differs from native |
| `form`      | string  | unset   | Associate with a `<form>` by id (same as native) |

`pressed` makes the button a toggle (think bold/italic in a toolbar);
it implies `role="button"` and `aria-pressed` is reflected on the host.

## Events

| Event | Detail | When |
|---|---|---|
| `click`  | native MouseEvent | Standard, except suppressed while `loading` or `disabled` |
| `change` | `{ pressed: boolean }` | Toggle mode only — fires when `pressed` flips |

## Keyboard

| Key | Effect |
|---|---|
| `Space`, `Enter` | Activate — same as click |
| `Tab` / `Shift+Tab` | Move focus (native order) |

## ARIA

| Attribute | When applied |
|---|---|
| `aria-busy="true"`     | While `loading` |
| `aria-pressed`         | When `pressed` attribute is present (toggle mode) |
| `aria-disabled="true"` | While `disabled` (in addition to the native disabled state) |

If the button has no visible text (icon-only), set `aria-label` —
the primitive doesn't synthesize one for you.

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-button-bg`         | `ButtonFace`     | Background |
| `--vyn-button-fg`         | `ButtonText`     | Foreground |
| `--vyn-button-border`     | `1px solid currentColor` | Border |
| `--vyn-button-radius`     | `4px`            | Corner radius |
| `--vyn-button-padding`    | `0.4em 0.8em`    | Padding (scaled by `size`) |
| `--vyn-button-hover-bg`   | `Highlight`      | Hover background |
| `--vyn-button-active-bg`  | `Highlight`      | Active/pressed background |
| `--vyn-button-focus-ring` | (global)         | Focus ring |

Variants set these vars to picked-up values — `variant="primary"`
overrides `--vyn-button-bg` and `--vyn-button-fg` to a primary
palette. Override per-app via CSS or set the vars on the host
directly.

## Accessibility notes

- The primitive is a `<button>` underneath — pressing Enter inside a
  form submits, exactly as native. Set `type="button"` if you want
  to block submission.
- Toggle-button mode (`pressed`) is the right pattern for sticky
  state like "bold." It is NOT the right pattern for a switch
  (use [`<v-toggle>`](/ui/toggle/)) or a checkbox
  ([`<v-checkbox>`](/ui/checkbox/)).
- `loading` keeps the button focusable so screen-reader users know
  it exists and is busy. To unfocus the spinner during loading, set
  `disabled` and `loading` together.
- Icon-only buttons need `aria-label`. The framework warns in dev
  mode if a v-button has no accessible name.

## Programmatic control

```ts
button.loading = true;
button.pressed = !button.pressed;
button.click();    // standard
button.focus();    // standard
```

## See also

- [`<v-toggle>`](/ui/toggle/) — a switch, not a button
- [`<v-checkbox>`](/ui/checkbox/) — boolean form input
- [Components guide](/guide/components/) — write your own

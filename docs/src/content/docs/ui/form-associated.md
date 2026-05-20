---
title: form-associated
description: Make any element with a value participate in `<form>` submission and validation. The bridge between custom data-attribute controls and native forms.
sidebar:
  order: 11
---

`@vyn/ui/form-associated` lets a non-input element submit its value
with a surrounding `<form>`. Apply `data-form-name="..."` and the
behavior wires up a hidden internal input that mirrors the element's
`data-value`, syncs validity, and participates in `FormData`,
`reset`, and submission like a native control.

```html
<form>
	<div role="radiogroup" data-keyboard-nav data-select="single"
	     data-value="pro" data-form-name="plan" data-required>
		<button data-value="free">Free</button>
		<button data-value="pro">Pro</button>
		<button data-value="team">Team</button>
	</div>
	<button type="submit">Continue</button>
</form>
```

```ts
import "@vyn/ui/select";
import "@vyn/ui/keyboard-nav";
import "@vyn/ui/form-associated";

document.querySelector("form")!.addEventListener("submit", (e) => {
	e.preventDefault();
	const data = new FormData(e.target as HTMLFormElement);
	data.get("plan");   // "pro" — submits as a normal form field
});
```

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-form-name` | string | required | Form field name (what `FormData.get()` returns under) |
| `data-required` | boolean | absent | Form is invalid if `data-value` is empty |
| `data-form-disabled` | boolean | absent | Excluded from form submission (like native `disabled`) |
| `data-validity` | string | unset | Custom validity message; when present, the form is invalid |

The behavior reads `data-value` on the element as the source of
truth. It works with anything that writes `data-value` —
[`@vyn/ui/select`](/ui/select/), custom widgets, manual assignment.

## What it does

- Creates a hidden `<input>` inside the element on first wire-up,
  mirroring `data-value` to the input's `value`.
- Watches `data-value` for changes (MutationObserver) and re-syncs.
- Applies `required` and `setCustomValidity()` based on attributes.
- Cleans up the hidden input when the element is removed.

## Why this exists

Custom elements have a native API for form association
(`formAssociated = true` + `ElementInternals`), but it only works
inside actual custom elements — you can't apply it to a plain
`<div>` or `<ul>` you wrote yourself. This behavior gives any
element with a `data-value` that same form-participation contract
without requiring a custom-element registration.

For prebuilt widgets like [`<v-combobox>`](/ui/combobox/), the
custom element handles form association natively; the behavior is
for the data-attribute path.

## Events

The behavior re-dispatches the underlying input's events on the host
element:

| Event | When |
|---|---|
| `invalid` | The hidden input fails native validation (required, custom validity) |

## Validation

```ts
const el = document.querySelector("[data-form-name=plan]") as HTMLElement;

el.dataset.validity = "Pick a plan to continue.";    // mark invalid
el.dataset.validity = "";                            // clear
```

The browser's native error UI shows on submit, anchored to the
element. For inline error display, listen to `invalid` and render
your own message — pair with
[`aria-describedby`](/ui/aria-describedby/).

## See also

- [`@vyn/ui/select`](/ui/select/) — the primary writer of `data-value`
- [`@vyn/ui/aria-describedby`](/ui/aria-describedby/) — for inline error messages

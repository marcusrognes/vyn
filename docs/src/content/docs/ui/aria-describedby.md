---
title: aria-describedby
description: Pair two elements with aria-describedby — descriptions, help text, hint cards. A tiny behavior, but enough widgets need it to factor out.
sidebar:
  order: 9
---

`@vyn/ui/aria-describedby` wires an `aria-describedby` relationship
between two elements when one declares `data-describes="target-id"`.
Use it for form-field help text, error messages, contextual hints
that should be announced by a screen reader along with the
associated control.

```html
<label>
	Email
	<input id="email" type="email" required />
</label>
<p data-describes="email">We'll send confirmation here.</p>
```

```ts
import "@vyn/ui/aria-describedby";
```

The paragraph gets an auto-generated id; the input gets
`aria-describedby="<that-id>"`. Screen readers announce the
description after the input's label.

## Attributes

| Attribute | Type | What it does |
|---|---|---|
| `data-describes` | string | id of the element this describes |
| `data-describes-when` | `"always" \| "invalid"` | (default `"always"`) — when `"invalid"`, only attached while the target is in `:invalid` form state. Useful for error messages |

## What it does

- Generates a stable id on the descriptor element if it doesn't
  already have one.
- Appends that id to the target's `aria-describedby` (existing IDs
  are preserved; the framework de-duplicates).
- Removes the id from `aria-describedby` if the descriptor is
  removed from the DOM.
- For `data-describes-when="invalid"`: watches the target's
  `:invalid` state and attaches/detaches accordingly.

## Composing

For tooltips, [`tooltip`](/ui/tooltip/) wraps this behavior plus
positioning and hover/focus handling. Reach for `data-describes`
directly when you want the describedby relationship without the
floating UI.

For error messages tied to form fields:

```html
<input id="password" type="password" minlength="8" required />
<p data-describes="password" data-describes-when="invalid" role="alert">
	Password must be at least 8 characters.
</p>
```

The error message attaches as the description only when the field
is invalid, so screen readers announce it only when relevant.

## See also

- [`@vyn/ui/tooltip`](/ui/tooltip/) — wraps this with hover/focus floating UI
- [`@vyn/ui/live`](/ui/live/) — for one-off announcements not tied to a specific element

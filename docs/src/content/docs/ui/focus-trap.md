---
title: focus-trap
description: Constrain Tab focus inside an element. Restores focus on disconnect or when the trap deactivates. The behavior every modal needs.
sidebar:
  order: 8
---

`@vyn/ui/focus-trap` keeps keyboard focus inside an element while
it's active. Tabbing past the last focusable element wraps to the
first; Shift+Tab from the first wraps to the last. When the trap
deactivates (element removed, attribute cleared), focus returns to
where it was when the trap started.

Use it for modal dialogs and any overlay that should fully capture
attention. For non-modal overlays, use [`popover`](/ui/popover/) +
[`dismiss`](/ui/dismiss/) instead — they don't trap focus.

```html
<dialog id="confirm" data-focus-trap>
	<h2>Delete project?</h2>
	<form method="dialog">
		<button value="cancel" autofocus>Cancel</button>
		<button value="confirm">Delete</button>
	</form>
</dialog>
```

```ts
import "@vyn/ui/focus-trap";

document.getElementById("confirm")!.showModal();
```

When the dialog opens, focus enters and is trapped; when it closes,
focus returns to the previously-focused element.

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-focus-trap` | boolean | required | Activates the trap when the element is shown |
| `data-focus-trap-initial` | CSS selector | first focusable | Element to focus when the trap activates |
| `data-focus-trap-return` | `"true" \| "false"` | `"true"` | Restore focus to the previously-focused element on deactivate |
| `data-focus-trap-active` | `"true" \| "false"` | derived | Manually control active state (advanced; usually omitted) |

By default, the trap activates when the element transitions from
hidden to visible (detected via `display`, `visibility`, the
`hidden` attribute, or `<dialog>` open state). You can override by
setting `data-focus-trap-active` manually.

## Programmatic control

```ts
import { trapFocus } from "@vyn/client";

const release = trapFocus(el, { initial: el.querySelector("input") });

// later
release();   // deactivate; restores focus
```

The `trapFocus()` function is what the behavior uses internally —
call it directly when you don't want the attribute-driven activation.

## Notes

- Focusable elements are detected by standard rules: `<input>`,
  `<button>`, `<a href>`, `<select>`, `<textarea>`, `[tabindex="0"]`,
  and contenteditable elements. Disabled and hidden elements are
  excluded.
- The trap watches for added/removed focusables via MutationObserver
  so dynamic content (e.g., a form that reveals fields) stays
  trapped correctly.
- Native `<dialog>` with `showModal()` already provides an
  inert-rest-of-page behavior on supporting browsers; `focus-trap`
  layers on top for the wrap-around behavior the platform doesn't
  ship.
- For Esc-to-close, pair with [`dismiss`](/ui/dismiss/) — focus-trap
  doesn't handle dismissal.

## See also

- [`@vyn/ui/dismiss`](/ui/dismiss/) — Esc / outside / focus-out dismissal
- [`@vyn/ui/popover`](/ui/popover/) — non-modal alternative without focus trap
- [Native `<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog) — what modals usually wrap

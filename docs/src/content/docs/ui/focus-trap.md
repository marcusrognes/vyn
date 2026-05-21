---
title: focus-trap
description: Contain Tab focus inside a non-modal element. For modals, use the native <dialog> + showModal() — that already traps focus.
sidebar:
  order: 8
---

**For modal dialogs, use native `<dialog>` + `.showModal()`** — the
browser already traps focus, makes the rest of the page `inert`,
handles backdrop, and supports Esc dismissal. No JS focus trap
needed.

```html
<dialog id="confirm">
	<form method="dialog">
		<button value="cancel" autofocus>Cancel</button>
		<button value="confirm">Delete</button>
	</form>
</dialog>
```

```ts
document.getElementById("confirm")!.showModal();
```

`@vyn/ui/focus-trap` exists for the **non-modal** cases:

- A side drawer that should trap focus while open but **not** block
  the rest of the page from rendering.
- A multi-step picker overlay that captures focus within its UI but
  isn't semantically a dialog.
- A custom dropdown that needs Tab to cycle through its options
  instead of moving past them.

For these, apply `data-focus-trap` to the element you want focus
constrained inside.

```html
<aside id="drawer" data-focus-trap hidden>
	<button>Close</button>
	<input name="search">
	<ul>…</ul>
</aside>
```

```ts
import "@vyn/ui/focus-trap";

drawer.hidden = false;
```

When the drawer becomes visible, focus is moved inside; Tab cycles
within the drawer. When the drawer is hidden again, focus returns
to where it was.

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-focus-trap` | boolean | required | Activates the trap when the element becomes visible |
| `data-focus-trap-initial` | CSS selector | first focusable | Element to focus when the trap activates |
| `data-focus-trap-return` | `"true" \| "false"` | `"true"` | Restore focus to the previously-focused element on deactivate |

The trap activates when the element transitions from hidden to
visible (detected via `display`, `visibility`, `hidden` attribute).
Hide the element again to release the trap.

## Programmatic control

```ts
import { trapFocus } from "@vyn/client";

const release = trapFocus(el, { initial: el.querySelector("input") });
// later
release();
```

## Notes

- Focusable elements are detected by standard rules: `<input>`,
  `<button>`, `<a href>`, `<select>`, `<textarea>`, `[tabindex="0"]`,
  contenteditable.
- The trap watches for added/removed focusables via MutationObserver
  so dynamic content stays trapped correctly.
- For "rest of page is non-interactive" without a full modal, use
  the native `inert` attribute on the page's main content while the
  drawer is open. Pair with `data-focus-trap` on the drawer for the
  inside-trap behavior.
- For Esc-to-close, pair with [`dismiss`](/vyn/ui/dismiss/).

## See also

- Native [`<dialog>.showModal()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal) — use this for modals
- Native [`inert` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inert) — for marking rest-of-page non-interactive
- [`@vyn/ui/dismiss`](/vyn/ui/dismiss/) — for Esc / outside / focus-out dismissal
- [Native platform](/vyn/guide/native-platform/) — what the browser already ships

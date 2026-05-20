---
title: <v-dialog>
description: A modal dialog wrapping the native <dialog> element with focus trap, focus restoration, Esc-to-dismiss, and proper ARIA.
---

A modal that wraps the native `<dialog>` element and adds the things
the platform doesn't: a focus trap, focus restoration on close, an
optional title/description ARIA wiring, and a `dismiss` event you can
intercept (to prompt "you have unsaved changes" before close).

```html
<v-dialog id="confirm" labelledby="confirm-title">
	<h2 id="confirm-title">Delete project?</h2>
	<p>This action cannot be undone.</p>
	<form method="dialog">
		<v-button variant="default">Cancel</v-button>
		<v-button variant="danger" value="confirm">Delete</v-button>
	</form>
</v-dialog>

<v-button id="open-confirm">Delete…</v-button>
```

```ts
import "@vyn/ui/dialog";

const dialog = document.querySelector<HTMLElement & { showModal(): void }>("#confirm")!;
document.querySelector("#open-confirm")!.addEventListener("click", () => dialog.showModal());

dialog.addEventListener("close", (e) => {
	const value = (e as CustomEvent<{ value: string }>).detail.value;
	if (value === "confirm") rpc.projects.delete.mutate(/* ... */);
});
```

## Slots

| Slot | What goes in it |
|---|---|
| (default) | The dialog content. Typically a heading, body, and an action row |

The conventional form structure (`<form method="dialog">` containing
buttons with `value` attributes) is supported — clicking such a
button closes the dialog and surfaces `value` in the `close` event.

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `open`              | boolean | `false` | Reflects open state. Setting it programmatically opens/closes |
| `labelledby`        | string  | unset   | id of an element inside the dialog to use as the accessible name |
| `describedby`       | string  | unset   | id of an element inside the dialog to use as the description |
| `dismiss-on-escape` | boolean | `true`  | Close on Esc (and fire `dismiss` first so caller can intercept) |
| `dismiss-on-backdrop` | boolean | `false` | Close when user clicks the backdrop. Off by default to prevent accidental close of forms |
| `return-focus`      | boolean | `true`  | Restore focus to the previously-focused element on close |

## Events

| Event | Detail | When |
|---|---|---|
| `open`     | `{}` | Dialog opened |
| `dismiss`  | `{ reason: "escape" \| "backdrop" \| "close-button" }` | Fires BEFORE close. Call `event.preventDefault()` to keep the dialog open (e.g., to show a confirmation) |
| `close`    | `{ value?: string }` | Dialog closed; `value` is the submit button's value if applicable |

## Keyboard

| Key | Effect |
|---|---|
| `Esc` | Fires `dismiss`; closes unless prevented |
| `Tab` / `Shift+Tab` | Cycles focus within the dialog (trapped) |
| `Enter` (inside `<form method="dialog">`) | Submits the default button |

## ARIA

| Element | Attribute | Value |
|---|---|---|
| `<v-dialog>` | `role`              | `"dialog"` |
| `<v-dialog>` | `aria-modal`        | `"true"` while open |
| `<v-dialog>` | `aria-labelledby`   | from the `labelledby` attribute |
| `<v-dialog>` | `aria-describedby`  | from the `describedby` attribute |

If `labelledby` is not set, the framework warns in dev mode — a
modal without an accessible name is bad UX.

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-dialog-bg`           | `Canvas`             | Dialog background |
| `--vyn-dialog-fg`           | `CanvasText`         | Foreground |
| `--vyn-dialog-border`       | `1px solid CanvasText` | Border |
| `--vyn-dialog-radius`       | `8px`                | Corner radius |
| `--vyn-dialog-padding`      | `1.5em`              | Content padding |
| `--vyn-dialog-shadow`       | `0 8px 32px rgba(0,0,0,0.25)` | Drop shadow |
| `--vyn-dialog-max-width`    | `min(32rem, 90vw)`   | Maximum width |
| `--vyn-dialog-backdrop`     | `rgba(0,0,0,0.5)`    | Backdrop overlay color |
| `--vyn-dialog-z`            | `1000`               | z-index |

The `::backdrop` pseudo-element is styled via the backdrop variable
when supported.

## Accessibility notes

- Focus traps within the dialog: Tab from the last focusable element
  cycles to the first; Shift+Tab from the first cycles to the last.
- On open, focus moves to the first focusable element inside the
  dialog. To override, set `autofocus` on a specific element.
- On close, focus returns to the element that had focus when
  `showModal()` was called (unless `return-focus="false"`).
- `dismiss-on-backdrop` defaults to **false** to prevent accidental
  close of long forms. Enable it for non-destructive dialogs.
- Native `<dialog>` is used internally, which gives you the
  inert-rest-of-page behavior for free on supporting browsers.
  Older browsers use a polyfill with manual `inert` attribute on
  siblings.
- The `dismiss` event lets you intercept close attempts — use it
  for "unsaved changes" prompts. Call `event.preventDefault()` and
  show your own confirm dialog.

## Programmatic control

```ts
dialog.showModal();              // open as modal (the common case)
dialog.show();                    // open as non-modal (rare; usually use <v-popover>)
dialog.close("save");             // close with a return value
dialog.returnValue;               // last close's value
```

## See also

- [`<v-popover>`](/ui/popover/) — non-modal alternative
- [`<v-button>`](/ui/button/) — the typical content of dialog action rows
- [Components guide](/guide/components/) — write your own

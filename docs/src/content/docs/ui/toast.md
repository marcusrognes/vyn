---
title: <v-toast>
description: Transient notifications announced via an aria-live region. Stack, auto-dismiss, queue, and survive route transitions.
---

A toast is a transient, non-interactive notification — "Saved",
"Couldn't connect, retrying…", "5 new notes". `<v-toast>` displays
one; `<v-toaster>` is the host element that stacks them and
announces them to screen readers via an `aria-live` region.

```html
<!-- once, in your SPA shell -->
<v-toaster id="toasts" position="bottom-end"></v-toaster>
```

```ts
import "@vyn/ui/toast";

const toaster = document.querySelector<HTMLElement & {
	show(opts: ToastOpts): string;
	dismiss(id: string): void;
}>("#toasts")!;

toaster.show({ message: "Note saved", level: "success" });
toaster.show({ message: "Could not reach server. Retrying…", level: "warning", duration: 0 });
```

## Types

```ts
type ToastOpts = {
	message:   string | Node;
	level?:    "info" | "success" | "warning" | "error";  // default "info"
	duration?: number;                                     // ms; default 4000; 0 = sticky until dismissed
	id?:       string;                                     // dedup — calling show() with the same id replaces
	action?:   { label: string; onClick: () => void };     // optional inline button
};
```

## `<v-toaster>` attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `position` | `"top-start" \| "top-end" \| "top-center" \| "bottom-start" \| "bottom-end" \| "bottom-center"` | `"bottom-end"` | Stack location |
| `max`      | number | `5` | Max concurrent toasts; oldest dismissed on overflow |
| `gap`      | string | `"0.5em"` | Gap between toasts (CSS) |

## `<v-toaster>` methods

| Method | Returns | What it does |
|---|---|---|
| `show(opts)`     | `string` | Show a toast; returns its id |
| `dismiss(id)`    | `void`   | Dismiss a specific toast |
| `dismissAll()`   | `void`   | Dismiss all visible toasts |
| `update(id, opts)` | `void` | Update an existing toast in place |

## Events (on `<v-toaster>`)

| Event | Detail | When |
|---|---|---|
| `show`     | `{ id }` | Toast became visible |
| `dismiss`  | `{ id; reason: "timeout" \| "user" \| "programmatic" \| "overflow" }` | Toast removed |
| `action`   | `{ id }` | Action button clicked (in addition to the action's own onClick) |

## Keyboard

| Key | Effect |
|---|---|
| `Esc` (when a toast has focus) | Dismiss it; focus returns to where it was before |
| `Tab` | Toasts are NOT in the Tab order by default; if a toast has an `action`, the toaster temporarily inserts it into the Tab order |

## ARIA

| Element | Attribute | Value |
|---|---|---|
| `<v-toaster>` | `role` | `"region"` |
| `<v-toaster>` | `aria-label` | from attribute, default `"Notifications"` |
| `<v-toast>` (info, success) | `role` | `"status"` (polite) |
| `<v-toast>` (warning, error) | `role` | `"alert"` (assertive) |
| `<v-toast>` (with action) | `role` | `"alertdialog"` if action exists, since it needs focus |

For non-urgent toasts (info, success), the toaster uses
`aria-live="polite"` so screen readers wait for a pause before
announcing. For warnings and errors, it uses `aria-live="assertive"`
to interrupt.

## CSS variables (per-toast)

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-toast-bg`         | `Canvas`             | Background |
| `--vyn-toast-fg`         | `CanvasText`         | Foreground |
| `--vyn-toast-border`     | `1px solid CanvasText` | Border |
| `--vyn-toast-radius`     | `6px`                | Corner radius |
| `--vyn-toast-padding`    | `0.8em 1em`          | Padding |
| `--vyn-toast-shadow`     | `0 4px 16px rgba(0,0,0,0.2)` | Drop shadow |
| `--vyn-toast-info-fg`    | `CanvasText`         | Info-level accent |
| `--vyn-toast-success-fg` | `MarkText`           | Success accent |
| `--vyn-toast-warning-fg` | `MarkText`           | Warning accent |
| `--vyn-toast-error-fg`   | `LinkText`           | Error accent |
| `--vyn-toast-min-width`  | `16rem`              | Min width |
| `--vyn-toast-max-width`  | `min(28rem, 90vw)`   | Max width |

## Accessibility notes

- The toaster lives outside route content so it survives route
  transitions. Mount it once in the SPA shell, not per route.
- Default `duration` (4s) is short. For important messages (errors,
  warnings), set `duration: 0` so the user dismisses explicitly.
- Toasts with actions take focus when shown (alertdialog pattern)
  so the action is reachable; toasts without actions never steal
  focus.
- `prefers-reduced-motion` skips the slide-in animation; toasts
  appear instantly.
- Hovering a toast pauses its auto-dismiss timer. Mousing out
  resumes it.

## Programmatic control

```ts
const id = toaster.show({ message: "Uploading…", duration: 0 });
// ... later
toaster.update(id, { message: "Upload complete!", level: "success", duration: 3000 });
// or
toaster.dismiss(id);
```

## Convenience helpers

`@vyn/ui/toast` also exports a module-scope helper that finds the
nearest `<v-toaster>` in the document:

```ts
import { toast } from "@vyn/ui/toast";

toast.success("Saved");
toast.error("Could not save", { duration: 0 });
toast.warning("Slow connection");
toast.info("3 new messages");
```

## See also

- [`@vyn/ui/focus-trap`](/ui/focus-trap/) + native `<dialog>` — for interactive modal dialogs
- [`@vyn/ui/live`](/ui/live/) — for one-off `aria-live` announcements without the toast UI
- [Components guide](/guide/components/) — for writing your own

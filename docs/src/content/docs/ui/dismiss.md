---
title: dismiss
description: Esc, outside-click, and focus-out dismissal for cases the native Popover API doesn't cover. Cancelable, composable, one event.
sidebar:
  order: 5
---

The native [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
already handles Esc and outside-click dismissal for elements with
the `popover` attribute. **Use it first** — the browser ships the
right behavior, and you don't need this module.

`@vyn/ui/dismiss` exists for the cases the native API doesn't cover:

- Non-popover elements (drawers, custom overlays) that still need
  Esc / outside-click / focus-out dismissal
- Cancelable dismiss (intercept the close, prompt "unsaved changes?")
- Focus-out detection (popover API doesn't dismiss on focus leaving
  the subtree)

```html
<aside id="drawer" data-dismiss data-dismiss-on="escape outside">
	A side panel that closes itself.
</aside>
```

```ts
import "@vyn/ui/dismiss";

document.getElementById("drawer")!.addEventListener("dismiss", (e) => {
	if (hasUnsavedChanges) {
		e.preventDefault();
		showConfirmDialog();
	} else {
		closeDrawer();
	}
});
```

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-dismiss` | boolean | required | Activates the behavior |
| `data-dismiss-on` | space-separated list of `"escape" \| "outside" \| "focus-out"` | `"escape outside"` | Which triggers fire |
| `data-dismiss-restore-focus` | `"true" \| "false"` | `"true"` | After dismiss, restore focus to where it was when the element first received focus |

## Events

| Event | Detail | When |
|---|---|---|
| `dismiss` | `{ reason: "escape" \| "outside" \| "focus-out" }` | A configured trigger fired |

The event is **cancelable**. Call `event.preventDefault()` to keep
the element open and skip focus restoration. Useful for "unsaved
changes" prompts that the native API doesn't provide.

## Behavior details

- **Escape:** captures Esc on the element (or a descendant) when the
  document's focus is within. Multiple elements with `data-dismiss`
  fire only the innermost.
- **Outside click:** registers one document-level click listener
  shared across all `data-dismiss` instances.
- **Focus-out:** uses `focusout` to detect focus leaving the element
  subtree. Short debounce so focus moving between descendants doesn't
  trigger.

## Composing

For dropdown menus, [`popover`](/ui/popover/) bundles `dismiss`
internally. Reach for `dismiss` directly when:

- You're working with a non-popover element (sidebar, drawer, custom
  overlay)
- You need `focus-out` (the native popover API doesn't dismiss on
  focus leaving — only on outside click)
- You need to intercept dismiss with `preventDefault`

## See also

- Native [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) — handles Esc + outside-click for `popover` elements automatically
- [`@vyn/ui/popover`](/ui/popover/) — composes `dismiss` with anchor positioning
- [`@vyn/ui/focus-trap`](/ui/focus-trap/) — for modal-style focus containment

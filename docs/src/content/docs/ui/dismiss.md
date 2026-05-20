---
title: dismiss
description: Esc, outside-click, and focus-out dismissal as a reusable behavior. One event handler covers menus, popovers, dialogs, drawers.
sidebar:
  order: 5
---

`@vyn/ui/dismiss` watches an element for Esc keypresses, outside
clicks, and focus moving out of its descendants. When any of those
happens, it fires a `dismiss` event with a `reason`. The element
itself decides what to do — close, save, animate.

```html
<div data-dismiss data-dismiss-on="escape outside focus-out">
	A panel that closes itself.
</div>
```

```ts
import "@vyn/ui/dismiss";

panel.addEventListener("dismiss", (e) => {
	const { reason } = (e as CustomEvent<{ reason: string }>).detail;
	closePanel();
});
```

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-dismiss` | boolean | required | Activates the behavior |
| `data-dismiss-on` | space-separated list of `"escape" \| "outside" \| "focus-out"` | `"escape outside"` | Which triggers dispatch `dismiss` |
| `data-dismiss-restore-focus` | `"true" \| "false"` | `"true"` | After dismiss, restore focus to where it was when the element first received focus |

## Events

| Event | Detail | When |
|---|---|---|
| `dismiss` | `{ reason: "escape" \| "outside" \| "focus-out" }` | A configured trigger fired |

The event is **cancelable** — call `event.preventDefault()` to keep
the element open and skip focus restoration. Useful for "unsaved
changes, are you sure?" interception.

## Behavior details

- **Escape:** captures Esc on the element (or a descendant) when the
  document's focus is within. Multiple elements with `data-dismiss`
  fire only the innermost one (the listener uses capture phase and
  stops propagation on dispatch).
- **Outside click:** registers a single document-level click
  listener that fires only when the click is outside the element's
  subtree. Multiple elements with `data-dismiss` share the listener.
- **Focus-out:** uses `focusout` to detect focus leaving the element
  subtree. Includes a short debounce so focus moving between
  descendants (e.g., into a child popover) doesn't trigger.

## Composing

Most floating UI patterns combine `dismiss` with `anchor` or
`popover`:

```html
<button id="menu-trigger" aria-haspopup="menu">Actions ▾</button>

<ul id="menu" role="menu"
    data-anchor="menu-trigger"
    data-dismiss data-dismiss-on="escape outside focus-out"
    data-keyboard-nav data-typeahead
    hidden>
	<li role="menuitem" data-key="archive">Archive</li>
	<li role="menuitem" data-key="duplicate">Duplicate</li>
</ul>
```

```ts
import "@vyn/ui/anchor";
import "@vyn/ui/dismiss";
import "@vyn/ui/keyboard-nav";
import "@vyn/ui/typeahead";

const trigger = document.getElementById("menu-trigger")!;
const menu = document.getElementById("menu")!;

trigger.addEventListener("click", () => { menu.hidden = false; menu.focus(); });
menu.addEventListener("dismiss", () => { menu.hidden = true; trigger.focus(); });
menu.addEventListener("activate", (e) => { /* handle activation */ menu.hidden = true; });
```

Four behavior imports, no custom element, full menu.

## See also

- [`@vyn/ui/popover`](/ui/popover/) — bundles `anchor` + `dismiss` + show/hide
- [`@vyn/ui/focus-trap`](/ui/focus-trap/) — for modals where dismiss is one of the patterns

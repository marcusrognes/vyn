---
title: copy
description: A button that copies a target's text to the clipboard with visible feedback. One attribute, no JS.
sidebar:
  order: 18
---

`@vyn/ui/copy` makes a button copy a target element's text to the
clipboard. The button briefly flips to a `data-state="copied"`
state so your CSS can show "Copied!" feedback; ARIA announces the
result.

```html
<pre><code id="snippet">npm create vyn@latest my-app</code></pre>
<button data-copy="snippet">Copy</button>
```

```ts
import "@vyn/ui/copy";
```

That's it. Click copies the code; the button visually says "Copied"
for ~1.5s; assistive tech is informed via `live` announcement.

## Attributes

| Attribute | Type | What it does |
|---|---|---|
| `data-copy` | string | id of the target element whose `textContent` is copied |
| `data-copy-value` | string | Copy this literal string instead of a target's text |
| `data-copy-feedback-ms` | number | How long to show the copied state (default `1500`) |
| `data-copy-label` | string | aria-label used while in copied state (default `"Copied"`) |

If both `data-copy` and `data-copy-value` are set, `data-copy-value`
wins.

## Events

| Event | Detail | When |
|---|---|---|
| `copy` | `{ value: string }` | Successful copy |
| `copy-error` | `{ error: Error }` | Clipboard API failed (no permission, no clipboard, etc.) |

## What it sets

| Attribute | When |
|---|---|
| `data-state="copied"` | For `data-copy-feedback-ms` ms after a successful copy |

```css
[data-copy][data-state="copied"]::after {
	content: " ✓";
	color: MarkText;
}
```

## ARIA

After a successful copy, the behavior announces "Copied to
clipboard" via [`liveRegion`](/vyn/ui/live/). No focus shift, no popup.

## See also

- [`@vyn/ui/live`](/vyn/ui/live/) — used internally for the announcement

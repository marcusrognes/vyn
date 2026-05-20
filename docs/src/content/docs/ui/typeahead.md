---
title: typeahead
description: Letter-key jump-to-item behavior. Composes with keyboard-nav or works standalone for type-to-find patterns.
sidebar:
  order: 6
---

`@vyn/ui/typeahead` listens for letter and digit keypresses on a
container and jumps focus to the next matching item. The match is
against the item's text content (or `data-label`) and resets after
a configurable timeout.

`keyboard-nav` accepts a `data-typeahead` flag that turns this on
internally. This page documents the standalone module — useful for
patterns like "type to find" in a tree, file picker, or autocomplete
input that doesn't use the listbox pattern.

```html
<ul data-typeahead>
	<li tabindex="0">Apple</li>
	<li tabindex="0">Banana</li>
	<li tabindex="0">Blueberry</li>
	<li tabindex="0">Cherry</li>
</ul>
```

```ts
import "@vyn/ui/typeahead";
```

## Attributes (on the container)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-typeahead` | boolean | required | Activates the behavior |
| `data-items` | CSS selector | `":scope > *"` | Selector identifying items |
| `data-timeout` | number | `500` | ms before the typed buffer clears |
| `data-from-current` | `"true" \| "false"` | `"true"` | Start matching from the currently-focused item (so typing the same letter repeats cycle); `"false"` always restarts from the first item |

## Attributes (on items)

| Attribute | What it does |
|---|---|
| `data-label` | Override the matching string (defaults to `textContent`, lowercased and trimmed) |
| `data-disabled` | Items with this attribute are skipped |

## Events

| Event | Detail | When |
|---|---|---|
| `typeahead-match` | `{ item: Element; buffer: string }` | A letter-key matched an item; the item is focused before the event fires |
| `typeahead-no-match` | `{ buffer: string }` | A keypress extended the buffer but nothing matches |

## Keyboard

| Key | Effect |
|---|---|
| `a-z`, `0-9`, accented letters | Appended to the buffer; focus jumps to the next item whose label starts with the buffer |
| `Backspace` | Removes the last buffered character |
| `Esc` | Clears the buffer immediately |
| any other key | Clears the buffer |

If the buffer is one character and the same character is pressed
again, focus advances to the next item starting with that letter
(the "press F repeatedly to cycle through F-named items" pattern).
Pressing two different letters within the timeout treats them as a
prefix instead.

## See also

- [`@vyn/ui/keyboard-nav`](/ui/keyboard-nav/) — for full arrow-key + typeahead lists; usually paired

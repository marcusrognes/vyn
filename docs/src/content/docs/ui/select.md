---
title: select
description: Single or multi-select state on any list via data attributes. Reads and writes a value, fires change events, sets aria-selected. Composes with keyboard-nav.
sidebar:
  order: 3
---

`@vyn/ui/select` is a small behavior module that adds selection
state to any container of items. Pair it with
[`@vyn/ui/keyboard-nav`](/ui/keyboard-nav/) for keyboard
operation; alone it handles mouse + programmatic selection and the
`aria-selected` state.

```html
<ul data-select="single" data-value="editor" data-keyboard-nav>
	<li data-value="admin">Admin</li>
	<li data-value="editor">Editor</li>
	<li data-value="viewer">Viewer</li>
</ul>
```

```ts
import "@vyn/ui/select";
import "@vyn/ui/keyboard-nav";

document.querySelector("ul")!.addEventListener("change", (e) => {
	const { value } = (e as CustomEvent<{ value: string | string[] }>).detail;
	// single: "editor"; multiple: ["admin", "editor"]
});
```

## What it does

For every element with `[data-select]`:

- Tracks selection via the container's `data-value` attribute
  (single: one string; multiple: comma-separated)
- Adds `aria-selected="true"` to items whose `data-value` matches
- Wires click to set or toggle selection
- Wires Enter/Space (via keyboard-nav's `activate` event) to do the same
- Fires `change` on the container with the new value(s)

## Attributes (on the container)

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `data-select`         | `"single" \| "multiple"` | required | Selection mode |
| `data-value`          | string | unset | Current value(s). For `multiple`, comma-separated |
| `data-follows-focus`  | `"true" \| "false"` | `"true"` for single, `"false"` for multiple | Whether arrow-key focus changes selection (single mode only) |
| `data-required`       | boolean | absent | Don't allow deselecting the last item |
| `data-items`          | CSS selector | `":scope > *"` | Override the items selector |

## Attributes (on items)

| Attribute | What it does |
|---|---|
| `data-value`   | The item's value. Required for selection to work |
| `data-disabled` | Cannot be selected (and is skipped if `keyboard-nav` is present) |

## Events

| Event | Detail | When |
|---|---|---|
| `change` | `{ value: string \| string[] }` | Selection changed (user click, keyboard activate, or programmatic) |

The container's `data-value` attribute is updated before `change`
fires, so handlers can read either source.

## ARIA

The behavior writes:

- `aria-selected="true"` on items matching the selection
- `aria-selected="false"` on items not matching (in multiple mode; single mode omits the attribute on unselected for brevity)
- `aria-multiselectable="true"` on the container when `data-select="multiple"`

It does NOT set `role` on the container — you do that. Common
choices: `role="listbox"` (with items as `role="option"`),
`role="radiogroup"` (with `role="radio"`), or a tab pattern.

## Programmatic control

The container is the source of truth. Read or write `data-value`:

```ts
ul.dataset.value;                          // → "editor" (single) or "admin,editor" (multiple)
ul.dataset.value = "viewer";               // sets selection programmatically; fires change
ul.dataset.value = "admin,editor";         // multi
```

You can also dispatch a synthetic activate from another control:

```ts
const item = ul.querySelector("[data-value=editor]")!;
item.dispatchEvent(new CustomEvent("activate", { bubbles: true }));
```

## Composing examples

### Listbox

```html
<ul role="listbox" data-keyboard-nav data-select="single" data-value="editor">
	<li role="option" data-value="admin">Admin</li>
	<li role="option" data-value="editor">Editor</li>
	<li role="option" data-value="viewer">Viewer</li>
</ul>
```

Three lines of script: `import "@vyn/ui/keyboard-nav"; import "@vyn/ui/select"`,
plus your `change` handler. That's the whole listbox.

### Radio group

```html
<div role="radiogroup" data-keyboard-nav data-select="single" data-value="pro">
	<label><input type="radio" hidden data-value="free">Free</label>
	<label><input type="radio" hidden data-value="pro">Pro</label>
	<label><input type="radio" hidden data-value="team">Team</label>
</div>
```

`data-items="label"` if the labels aren't direct children. Selection
follows focus by default in single mode — the radiogroup pattern.

### Toolbar with toggle buttons (multi)

```html
<div role="toolbar" data-keyboard-nav="horizontal" data-select="multiple" data-value="bold,italic">
	<button data-value="bold" aria-label="Bold">B</button>
	<button data-value="italic" aria-label="Italic"><i>I</i></button>
	<button data-value="underline" aria-label="Underline">U</button>
</div>
```

Buttons get `aria-pressed` from the behavior automatically (since
they have `role="button"` implicitly and the toolbar context calls
for pressed state, not selected).

## When NOT to use this

When the selection state must round-trip to the server before
applying — for example, a remote-validated radio choice. The
behavior writes `data-value` immediately on user action; you'd be
fighting it. For controlled selection, listen for `change`, call
`event.preventDefault()` to reject, and reassign `data-value` after
the server confirms.

```ts
ul.addEventListener("change", async (e) => {
	const next = (e as CustomEvent<{ value: string }>).detail.value;
	const prev = ul.dataset.value;
	ul.dataset.value = prev;            // revert
	const accepted = await rpc.something.mutate({ value: next });
	if (accepted) ul.dataset.value = next;
});
```

## Implementation note

~80 lines. The behavior is mostly attribute parsing + click handler
+ event dispatch. The keyboard work is offloaded to
[`@vyn/ui/keyboard-nav`](/ui/keyboard-nav/), which you import
alongside.

## See also

- [`@vyn/ui/keyboard-nav`](/ui/keyboard-nav/) — arrow keys and focus management; usually paired
- [`@vyn/ui/form-associated`](/ui/form-associated/) — to make a `data-select` container submit a value with a `<form>`
- [`<v-combobox>`](/ui/combobox/) — input + listbox widget when the `aria-activedescendant` pattern is needed

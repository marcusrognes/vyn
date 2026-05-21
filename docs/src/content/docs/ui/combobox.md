---
title: <v-combobox>
description: A text input paired with a listbox of suggestions. Type-to-filter, arrow keys to navigate, Enter to commit. The hardest accessible widget done right.
---

A combobox is a text input with an associated listbox of options.
The user types to filter, navigates with arrow keys, and commits a
choice with Enter. It's the right primitive for autocomplete, tag
selection, and any "pick from a list, possibly typing to find it"
pattern.

`<v-combobox>` is also one of the hardest widgets to make accessible
correctly. Vyn implements the ARIA 1.2 "combobox with listbox popup"
pattern; you provide the items, the component handles the keyboard,
focus, and screen-reader announcements.

```html
<v-combobox id="assignee" placeholder="Assign to…"></v-combobox>
```

```ts
import "@vyn/ui/combobox";

const combo = document.querySelector<HTMLElement & {
	items: ComboboxItem[];
	value: string | null;
}>("#assignee")!;

combo.items = users.map((u) => ({ id: u._id, label: u.name, sublabel: u.email }));

combo.addEventListener("change", (e) => {
	const { value } = (e as CustomEvent<{ value: string | null }>).detail;
	rpc.tasks.assign.mutate({ _id: taskId, assigneeId: value });
});
```

## Properties

| Property | Type | What it does |
|---|---|---|
| `items` | `ComboboxItem[]` | Available options |
| `value` | `string \| null` | Selected option id; two-way |
| `inputValue` | `string` | Text the user has typed; two-way |
| `filter` | `(items, query) => items` | Custom filter; defaults to case-insensitive substring match on `label` |
| `getKey` | `(item) => string` | id accessor; defaults to `item.id` |

```ts
type ComboboxItem = {
	id:        string;
	label:     string;
	sublabel?: string;   // optional secondary line
	disabled?: boolean;
	group?:    string;   // optional grouping; items with the same group render together with a header
};
```

## Attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `placeholder` | string | `""` | Input placeholder |
| `allow-custom` | boolean | `false` | Allow committing a value that isn't in the list (free-text mode) |
| `clear-on-blur` | boolean | `true` | If the input doesn't match a selected item on blur, restore it |
| `open-on-focus` | boolean | `false` | Show the listbox immediately on focus, before typing |
| `min-chars` | number | `0` | Don't open the listbox until the user has typed this many characters |
| `loading` | boolean | `false` | Show a loading indicator (e.g., while fetching async items) |
| `disabled` | boolean | `false` | Disable the input |

## Events

| Event | Detail | When |
|---|---|---|
| `change` | `{ value: string \| null }` | Selected item changed (or cleared) |
| `input`  | `{ value: string }` | User typed; useful for async fetching |
| `open`   | `{}` | Listbox opened |
| `close`  | `{}` | Listbox closed |

For async data, listen to `input` and reassign `items`:

```ts
combo.addEventListener("input", debounce(async (e: CustomEvent) => {
	combo.loading = true;
	combo.items = await rpc.users.search.query({ q: e.detail.value });
	combo.loading = false;
}, 200));
```

## Keyboard

When the input has focus:

| Key | Effect |
|---|---|
| `ArrowDown` | Open the listbox (if closed); move focus to next option |
| `ArrowUp`   | Open; move focus to previous option |
| `Home` / `End` | First / last option (when listbox open) |
| `Enter`     | Commit focused option; close listbox |
| `Esc`       | Close listbox without committing; second Esc clears input |
| `Tab`       | Commit focused option (if any); close listbox; advance focus |
| (any text)  | Filter the listbox |
| `Backspace` on empty | Clears `value` and fires `change` with `null` |

The input retains focus throughout — focus visibly stays on the
input while `aria-activedescendant` tracks the focused option.

## ARIA

| Element | Attribute | Value |
|---|---|---|
| input | `role` | `"combobox"` |
| input | `aria-expanded` | `"true"` / `"false"` |
| input | `aria-controls` | listbox's id |
| input | `aria-autocomplete` | `"list"` |
| input | `aria-activedescendant` | id of the focused option |
| listbox | `role` | `"listbox"` |
| option | `role` | `"option"` |
| option | `aria-selected` | when matches current value |

The combobox uses `aria-activedescendant`, not roving tabindex —
focus stays in the input while the listbox tracks a "virtual focus"
on the active option. Screen readers announce the active option as
the user arrows through.

## CSS variables

| Variable | Default | What it styles |
|---|---|---|
| `--vyn-combobox-bg`           | `Field`              | Input background |
| `--vyn-combobox-fg`           | `FieldText`          | Input foreground |
| `--vyn-combobox-border`       | `1px solid FieldText` | Input border |
| `--vyn-combobox-radius`       | `4px`                | Input border radius |
| `--vyn-combobox-padding`      | `0.4em 0.6em`        | Input padding |
| `--vyn-combobox-listbox-bg`   | `Canvas`             | Listbox background |
| `--vyn-combobox-listbox-shadow` | `0 2px 8px rgba(0,0,0,0.15)` | Listbox shadow |
| `--vyn-combobox-option-padding` | `6px 12px`         | Option padding |
| `--vyn-combobox-option-active-bg` | `Highlight`      | Active option background |
| `--vyn-combobox-option-active-fg` | `HighlightText`  | Active option foreground |
| `--vyn-combobox-group-fg`     | `GrayText`           | Group header color |

## Accessibility notes

- The input retains focus the entire time. Screen-reader users
  hear the active option via `aria-activedescendant`, not via focus
  moving. This is the most reliable pattern for SR compatibility.
- `allow-custom` mode lets users commit values that aren't in the
  list — useful for tag-style input. The `change` event still fires
  with `value: null` (since there's no id); pair with `inputValue`
  to read what they typed.
- For async data, debounce your `input` listener. The combobox does
  not debounce internally because the right debounce depends on
  your network and back-end.
- The listbox uses the `popover` behavior internally for positioning —
  same flip + offset behavior, escapes `overflow: hidden` parents.
- Type-ahead in the input is filtering, not jumping. Letters narrow
  the listbox; they don't jump to the next matching option.

## Programmatic control

```ts
combo.open();
combo.close();
combo.value = "user-42";       // selects programmatically; updates inputValue to its label
combo.inputValue = "Bob";       // sets the text without selecting
combo.clear();                  // clears value and inputValue
```

## See also

- [`@vyn/ui/select`](/vyn/ui/select/) — selection state via `data-select` (used for non-input listboxes)
- [`@vyn/ui/popover`](/vyn/ui/popover/) — anchored positioning behavior used internally
- [`@vyn/ui/keyboard-nav`](/vyn/ui/keyboard-nav/) — for listboxes that don't need a free-text input

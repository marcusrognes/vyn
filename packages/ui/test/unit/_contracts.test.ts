import { describe, it } from "vyn:test";

// Per-behavior contracts. Each will get its own file as implementations
// land. Playwright-driven integration tests live under test/playwright/.

describe.todo("keyboard-nav — vertical arrows move focus through items");
describe.todo("keyboard-nav — Home/End jumps");
describe.todo("keyboard-nav — disabled items skipped");
describe.todo("keyboard-nav — roving tabindex (0 on focused, -1 on rest)");
describe.todo("keyboard-nav — typeahead flag enables letter-jump");
describe.todo("keyboard-nav — activate event on Enter/Space");
describe.todo("keyboard-nav — focuschange event on focus move");

describe.todo("typeahead — letter buffer matches and resets after timeout");
describe.todo("typeahead — same-letter cycles");

describe.todo("select — single mode: data-value tracks selection");
describe.todo("select — multiple mode: comma-separated value");
describe.todo("select — aria-selected reflects on items");
describe.todo("select — selection-follows-focus default in single mode");
describe.todo("select — change event fires on click + on keyboard-nav activate");

describe.todo("anchor — JS fallback positioning when CSS Anchor Positioning unsupported");
describe.todo("anchor — flip on insufficient space");
describe.todo("anchor — uses CSS API when supported");

describe.todo("dismiss — escape, outside, focus-out triggers");
describe.todo("dismiss — preventDefault keeps element open");
describe.todo("dismiss — focus restoration");

describe.todo("popover — combines anchor + dismiss");
describe.todo("popover — uses native popover attribute internally where supported");

describe.todo("focus-trap — Tab cycles within element");
describe.todo("focus-trap — focus restored to previous element on deactivate");

describe.todo("aria-describedby — pairs target with descriptor");
describe.todo("aria-describedby — invalid-only mode tracks :invalid");

describe.todo("tooltip — show on focus immediately, on hover after delay");
describe.todo("tooltip — esc dismisses");

describe.todo("form-associated — hidden input mirrors data-value");
describe.todo("form-associated — required, custom validity");

describe.todo("live — singleton aria-live regions (polite + assertive)");
describe.todo("live — throttle prevents stacking");

describe.todo("sort — header click cycles asc → desc → unsorted");
describe.todo("sort — aria-sort attribute reflects state");
describe.todo("sort — sort event includes key + direction + sortState");
describe.todo("sort — multi mode allows multiple active columns");

describe.todo("edit — Enter / F2 enters edit mode");
describe.todo("edit — Esc cancels");
describe.todo("edit — Enter / Tab commits, change event fires");

describe.todo("sortable — drag to reorder, reorder event fires");
describe.todo("sortable — keyboard pickup with Space, arrows to move");

describe.todo("drag-drop — typed zones via data-accepts");
describe.todo("drag-drop — keyboard fallback");

describe.todo("auto-resize — textarea grows with content");
describe.todo("auto-resize — respects min-rows / max-rows");

describe.todo("copy — writes textContent to clipboard");
describe.todo("copy — data-state='copied' for feedback");

describe.todo("scroll-into-view — container-level delegation");
describe.todo("scroll-into-view — triggers: focus, aria-selected, custom attr");

describe.todo("widget v-grid — data-driven cell rendering, range select");
describe.todo("widget v-table — sortable, row select, native table semantics");
describe.todo("widget v-combobox — aria-activedescendant pattern");
describe.todo("widget v-toaster — queue, dedup, position stacking");

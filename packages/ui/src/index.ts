// @vynjs/ui — behaviors + widgets. Each module side-effect-registers
// on import (behaviors scan the DOM via MutationObserver; widgets
// register as custom elements).
//
//   import "@vynjs/ui";                  // everything
//   import "@vynjs/ui/keyboard-nav";     // a single behavior
//   import "@vynjs/ui/v-toaster";        // a single widget

import "./keyboard-nav.ts";
import "./typeahead.ts";
import "./select.ts";
import "./dismiss.ts";
import "./focus-trap.ts";
import "./anchor.ts";
import "./popover.ts";
import "./tooltip.ts";
import "./scroll-into-view.ts";
import "./sort.ts";
import "./sortable.ts";
import "./drag-drop.ts";
import "./edit.ts";
import "./auto-resize.ts";
import "./aria-describedby.ts";
import "./form-associated.ts";
import "./copy.ts";
import "./v-toaster.ts";
import "./v-combobox.ts";
import "./v-table.ts";
import "./v-grid.ts";

export { live } from "./live.ts";

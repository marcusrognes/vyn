// @vyn/ui — behaviors + widgets. Each module side-effect-registers
// on import (behaviors scan the DOM via MutationObserver; widgets
// register as custom elements).
//
//   import "@vyn/ui";                  // everything
//   import "@vyn/ui/keyboard-nav";     // a single behavior
//   import "@vyn/ui/v-toaster";        // a single widget

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
import "./auto-resize.ts";
import "./aria-describedby.ts";
import "./copy.ts";
import "./v-toaster.ts";

export { live } from "./live.ts";

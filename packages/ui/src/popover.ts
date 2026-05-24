// data-popover — thin wrapper that prefers the native popover
// attribute when supported, layering anchor positioning + dismiss
// for browsers that don't support CSS Anchor Positioning yet.

function init() {
	document.querySelectorAll<HTMLElement>("[data-popover]:not([data-pop-wired])")
		.forEach(wire);
}

function wire(pop: HTMLElement) {
	pop.dataset.popWired = "true";

	// If the browser supports the native popover attribute, lean on it.
	if ("showPopover" in HTMLElement.prototype && !pop.hasAttribute("popover")) {
		pop.setAttribute("popover", "manual");
	}

	const triggerId = pop.dataset.popoverTrigger ?? pop.dataset.anchor;
	const trigger = triggerId ? document.getElementById(triggerId) : null;
	if (trigger) {
		trigger.setAttribute("aria-haspopup", "true");
		trigger.setAttribute("aria-controls", pop.id);
		trigger.setAttribute("aria-expanded", "false");
		trigger.addEventListener("click", () => toggle());
	}

	function toggle() {
		const open = pop.dataset.open === "true";
		if (open) close();
		else openIt();
	}
	function openIt() {
		pop.dataset.open = "true";
		trigger?.setAttribute("aria-expanded", "true");
		if ("showPopover" in pop) {
			try {
				(pop as any).showPopover();
			} catch { /* idempotent */ }
		}
		pop.dispatchEvent(new CustomEvent("open"));
	}
	function close() {
		pop.dataset.open = "false";
		trigger?.setAttribute("aria-expanded", "false");
		if ("hidePopover" in pop) {
			try {
				(pop as any).hidePopover();
			} catch { /* idempotent */ }
		}
		pop.dispatchEvent(new CustomEvent("close"));
	}

	// Outside-click dismissal.
	document.addEventListener("pointerdown", (e) => {
		if (pop.dataset.open !== "true") return;
		const target = e.target as Node;
		if (pop.contains(target) || trigger?.contains(target)) return;
		close();
	});
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && pop.dataset.open === "true") {
			e.preventDefault();
			close();
		}
	});
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else init();
	new MutationObserver(init).observe(
		document.body ?? document.documentElement,
		{ childList: true, subtree: true },
	);
}

export {};

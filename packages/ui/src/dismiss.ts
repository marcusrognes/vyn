// data-dismiss — Esc / outside-click / focus-out triggers a cancelable
// `dismiss` event. The native Popover API handles esc+outside for
// popover-attributed elements; use this for drawers, custom overlays,
// or cancel-able dismiss flows.

function init() {
	document.querySelectorAll<HTMLElement>("[data-dismiss]:not([data-dis-wired])")
		.forEach(wire);
}

function wire(el: HTMLElement) {
	el.dataset.disWired = "true";
	const triggers = (el.dataset.dismissOn ?? "escape outside").split(/\s+/);

	function fire(reason: "escape" | "outside" | "focus-out") {
		const event = new CustomEvent("dismiss", {
			detail: { reason },
			cancelable: true,
		});
		el.dispatchEvent(event);
		if (!event.defaultPrevented) {
			el.dispatchEvent(new CustomEvent("dismissed", { detail: { reason } }));
		}
	}

	if (triggers.includes("escape")) {
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && el.contains(document.activeElement)) {
				e.preventDefault();
				fire("escape");
			}
		});
	}

	if (triggers.includes("outside")) {
		document.addEventListener("pointerdown", (e) => {
			if (!el.contains(e.target as Node)) fire("outside");
		});
	}

	if (triggers.includes("focus-out")) {
		el.addEventListener("focusout", (e) => {
			setTimeout(() => {
				if (!el.contains(document.activeElement)) fire("focus-out");
			}, 0);
		});
	}
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

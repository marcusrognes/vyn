// data-scroll-into-view — when a child gains focus (or matches the
// configured trigger), scroll it into view within the container.

function init() {
	document.querySelectorAll<HTMLElement>(
		"[data-scroll-into-view]:not([data-siv-wired])",
	).forEach(wire);
}

function wire(container: HTMLElement) {
	container.dataset.sivWired = "true";
	const trigger = container.dataset.scrollIntoView || "focus";

	function scrollChild(child: Element) {
		if (!(child instanceof HTMLElement)) return;
		(child as any).scrollIntoView({
			block: "nearest",
			inline: "nearest",
			behavior: "smooth",
		});
	}

	if (trigger === "focus") {
		container.addEventListener("focusin", (e) => {
			if (e.target instanceof Element && container.contains(e.target)) {
				scrollChild(e.target);
			}
		});
	} else if (trigger === "selected") {
		const observer = new MutationObserver(() => {
			const sel = container.querySelector('[aria-selected="true"]');
			if (sel) scrollChild(sel);
		});
		observer.observe(container, {
			subtree: true,
			attributes: true,
			attributeFilter: ["aria-selected"],
		});
	} else {
		// Custom attribute name to watch on children
		const observer = new MutationObserver(() => {
			const sel = container.querySelector(`[${trigger}="true"]`);
			if (sel) scrollChild(sel);
		});
		observer.observe(container, { subtree: true, attributes: true });
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

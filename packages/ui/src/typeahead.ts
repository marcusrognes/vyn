// data-typeahead — letter buffer matches an item's textContent prefix,
// resets after a short idle window. Pairs with keyboard-nav for
// listbox-style navigation.

function init() {
	document.querySelectorAll<HTMLElement>(
		"[data-typeahead]:not([data-ta-wired])",
	).forEach(wire);
}

function wire(container: HTMLElement) {
	container.dataset.taWired = "true";
	const timeoutMs = Number(container.dataset.typeaheadTimeout ?? 500);
	let buffer = "";
	let lastKey = 0;

	function items(): HTMLElement[] {
		return [...container.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
	}

	container.addEventListener("keydown", (e) => {
		if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
		const now = Date.now();
		if (now - lastKey > timeoutMs) buffer = "";
		buffer += e.key.toLowerCase();
		lastKey = now;

		const list = items();
		const start = list.findIndex((i) => i === document.activeElement);
		// Search from after the current focus, wrap around.
		const order = [...list.slice(start + 1), ...list.slice(0, start + 1)];
		const hit = order.find((el) => (el.textContent ?? "").trim().toLowerCase().startsWith(buffer));
		if (hit) {
			e.preventDefault();
			list.forEach((i) => i.setAttribute("tabindex", "-1"));
			hit.setAttribute("tabindex", "0");
			hit.focus();
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

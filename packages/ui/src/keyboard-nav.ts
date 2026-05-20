// data-keyboard-nav — applies roving-tabindex + arrow-key navigation
// to children of the container. The container is the source of
// keydown events; focus delegates to the active item.

type Direction = "vertical" | "horizontal" | "both";

function init() {
	const containers = document.querySelectorAll<HTMLElement>("[data-keyboard-nav]:not([data-kn-wired])");
	containers.forEach((c) => wire(c));
}

function wire(container: HTMLElement) {
	container.dataset.knWired = "true";
	const direction = (container.dataset.direction as Direction | undefined) ?? "vertical";

	function items(): HTMLElement[] {
		return [...container.children]
			.filter((c): c is HTMLElement => c instanceof HTMLElement && !c.hasAttribute("disabled"));
	}

	function move(delta: number) {
		const list = items();
		if (!list.length) return;
		const current = document.activeElement instanceof HTMLElement ? list.indexOf(document.activeElement) : -1;
		const next = (current + delta + list.length) % list.length;
		focusItem(list[next]);
	}

	function focusItem(item: HTMLElement) {
		items().forEach((i) => i.setAttribute("tabindex", "-1"));
		item.setAttribute("tabindex", "0");
		item.focus();
		container.dispatchEvent(new CustomEvent("focuschange", { detail: { item } }));
	}

	// Set initial tabindex.
	const list = items();
	list.forEach((i, idx) => i.setAttribute("tabindex", idx === 0 ? "0" : "-1"));

	container.addEventListener("keydown", (e) => {
		const k = e.key;
		const list = items();
		if (k === "ArrowDown"  && direction !== "horizontal") { e.preventDefault(); move(+1); }
		if (k === "ArrowUp"    && direction !== "horizontal") { e.preventDefault(); move(-1); }
		if (k === "ArrowRight" && direction !== "vertical")   { e.preventDefault(); move(+1); }
		if (k === "ArrowLeft"  && direction !== "vertical")   { e.preventDefault(); move(-1); }
		if (k === "Home")  { e.preventDefault(); focusItem(list[0]); }
		if (k === "End")   { e.preventDefault(); focusItem(list[list.length - 1]); }
		if (k === "Enter" || k === " ") {
			const active = document.activeElement as HTMLElement | null;
			if (active && list.includes(active)) {
				e.preventDefault();
				container.dispatchEvent(new CustomEvent("activate", { detail: { item: active } }));
			}
		}
	});
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else { init(); }
	new MutationObserver(init).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

export {};

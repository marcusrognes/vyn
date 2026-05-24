// data-sort on a thead container — clicking [data-sort-key] cycles
// asc → desc → unsorted. aria-sort reflects state. A `sort` event
// bubbles up with the current sort state.

type Direction = "asc" | "desc" | undefined;

function init() {
	document.querySelectorAll<HTMLElement>("[data-sort]:not([data-srt-wired])")
		.forEach(wire);
}

function wire(container: HTMLElement) {
	container.dataset.srtWired = "true";
	const multi = container.dataset.sortMulti === "true";

	const state = new Map<string, Direction>();

	function paint() {
		for (
			const h of container.querySelectorAll<HTMLElement>("[data-sort-key]")
		) {
			const key = h.dataset.sortKey!;
			const dir = state.get(key);
			h.setAttribute(
				"aria-sort",
				dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none",
			);
		}
	}
	paint();

	container.addEventListener("click", (e) => {
		const header = (e.target as HTMLElement).closest<HTMLElement>(
			"[data-sort-key]",
		);
		if (!header || !container.contains(header)) return;
		const key = header.dataset.sortKey!;
		const cur = state.get(key);
		const next: Direction = cur === undefined ? "asc" : cur === "asc" ? "desc" : undefined;

		if (!multi) state.clear();
		if (next === undefined) state.delete(key);
		else state.set(key, next);

		paint();
		container.dispatchEvent(
			new CustomEvent("sort", {
				detail: {
					key,
					direction: next,
					sortState: [...state.entries()].map(([k, d]) => ({
						key: k,
						direction: d,
					})),
				},
			}),
		);
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

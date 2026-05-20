// data-select — single/multi selection. Reads data-value on items;
// writes data-value on the container; sets aria-selected.

function init() {
	const containers = document.querySelectorAll<HTMLElement>("[data-select]:not([data-sel-wired])");
	containers.forEach((c) => wire(c));
}

function wire(container: HTMLElement) {
	container.dataset.selWired = "true";
	const mode = container.dataset.select || "single";   // "single" | "multiple"; empty attr defaults to single

	function items(): HTMLElement[] {
		return [...container.querySelectorAll<HTMLElement>("[data-value]")];
	}

	function update(values: string[]) {
		container.dataset.value = mode === "single" ? (values[0] ?? "") : values.join(",");
		for (const item of items()) {
			const v = item.dataset.value!;
			const selected = values.includes(v);
			item.setAttribute("aria-selected", selected ? "true" : "false");
		}
		container.dispatchEvent(new CustomEvent("change", { detail: { value: mode === "single" ? values[0] : values } }));
	}

	function current(): string[] {
		const v = container.dataset.value ?? "";
		if (!v) return [];
		return mode === "single" ? [v] : v.split(",").filter(Boolean);
	}

	// Initial paint
	update(current());

	container.addEventListener("click", (e) => {
		const item = (e.target as HTMLElement).closest<HTMLElement>("[data-value]");
		if (!item || !container.contains(item)) return;
		const v   = item.dataset.value!;
		const cur = current();
		if (mode === "single") {
			update([v]);
		} else {
			const set = new Set(cur);
			if (set.has(v)) set.delete(v); else set.add(v);
			update([...set]);
		}
	});

	container.addEventListener("activate", (e: Event) => {
		const detail = (e as CustomEvent).detail;
		const v = detail?.item?.dataset?.value;
		if (!v) return;
		const cur = current();
		if (mode === "single") update([v]);
		else {
			const set = new Set(cur);
			if (set.has(v)) set.delete(v); else set.add(v);
			update([...set]);
		}
	});
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	new MutationObserver(init).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

export {};

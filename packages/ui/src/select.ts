// data-select — single / multiple selection with modifier-aware clicks.
//
//   data-select                  → single (default)
//   data-select="multiple"       → multi-select
//
// Multi-select honors keyboard modifiers:
//   plain click     → set selection to this item
//   ctrl/cmd+click  → toggle this item; updates anchor
//   shift+click     → range select from anchor to this item
//                     (additive when combined with ctrl/cmd)
//
// State:
//   container.dataset.value     — CSV of selected values
//   container.dataset.selAnchor — value of the last "primary" click
//   item.aria-selected          — "true" / "false"
//
// Events:
//   `change` on the container, detail = { value: string | string[] }

function init() {
	const containers = document.querySelectorAll<HTMLElement>(
		"[data-select]:not([data-sel-wired])",
	);
	containers.forEach((c) => wire(c));
}

function wire(container: HTMLElement) {
	container.dataset.selWired = "true";
	const mode = container.dataset.select || "single"; // "single" | "multiple" | ""(=single)

	function items(): HTMLElement[] {
		return [...container.querySelectorAll<HTMLElement>("[data-value]")];
	}

	function update(values: string[]) {
		container.dataset.value = mode === "multiple" ? values.join(",") : (values[0] ?? "");
		for (const item of items()) {
			const v = item.dataset.value!;
			item.setAttribute("aria-selected", values.includes(v) ? "true" : "false");
		}
		container.dispatchEvent(
			new CustomEvent("change", {
				detail: { value: mode === "multiple" ? values : values[0] },
			}),
		);
	}

	function current(): string[] {
		const v = container.dataset.value ?? "";
		if (!v) return [];
		return mode === "multiple" ? v.split(",").filter(Boolean) : [v];
	}

	// Initial paint
	update(current());

	container.addEventListener("click", (e) => {
		const item = (e.target as HTMLElement).closest<HTMLElement>("[data-value]");
		if (!item || !container.contains(item)) return;

		const v = item.dataset.value!;

		if (mode !== "multiple") {
			update([v]);
			container.dataset.selAnchor = v;
			return;
		}

		const list = items();
		const cur = new Set(current());
		const me = e as MouseEvent;
		const ctrl = me.ctrlKey || me.metaKey;
		const shift = me.shiftKey;

		if (shift) {
			// Range from anchor (or this item if none) to this item.
			const anchor = container.dataset.selAnchor;
			const ai = anchor ? list.findIndex((it) => it.dataset.value === anchor) : -1;
			const ti = list.indexOf(item);
			if (ai < 0 || ti < 0) {
				if (!ctrl) cur.clear();
				cur.add(v);
			} else {
				const [lo, hi] = ai < ti ? [ai, ti] : [ti, ai];
				if (!ctrl) cur.clear();
				for (let i = lo; i <= hi; i++) cur.add(list[i].dataset.value!);
			}
		} else if (ctrl) {
			if (cur.has(v)) cur.delete(v);
			else cur.add(v);
			container.dataset.selAnchor = v;
		} else {
			cur.clear();
			cur.add(v);
			container.dataset.selAnchor = v;
		}

		update([...cur]);
	});

	// Programmatic "activate" support (keyboard-nav fires this with item ref).
	container.addEventListener("activate", (e: Event) => {
		const detail = (e as CustomEvent).detail;
		const v = detail?.item?.dataset?.value;
		if (!v) return;
		const cur = new Set(current());
		if (mode === "multiple") {
			if (cur.has(v)) cur.delete(v);
			else cur.add(v);
			update([...cur]);
			container.dataset.selAnchor = v;
		} else {
			update([v]);
			container.dataset.selAnchor = v;
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

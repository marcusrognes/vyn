// data-sortable on a container — drag children to reorder.
// Pointer-based; keyboard fallback via Space-to-pickup + arrows.

function init() {
	document.querySelectorAll<HTMLElement>("[data-sortable]:not([data-sortable-wired])").forEach(wire);
}

function wire(container: HTMLElement) {
	container.dataset.sortableWired = "true";
	let dragEl: HTMLElement | null = null;
	let pickedKeyboard: HTMLElement | null = null;

	function items(): HTMLElement[] {
		return [...container.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
	}

	function fireReorder() {
		container.dispatchEvent(new CustomEvent("reorder", {
			detail: { order: items().map((el, i) => ({ index: i, id: el.dataset.id ?? el.id })) },
		}));
	}

	container.addEventListener("dragstart", (e) => {
		const t = (e.target as HTMLElement);
		if (!container.contains(t) || t.parentElement !== container) return;
		dragEl = t;
		t.dataset.state = "dragging";
		e.dataTransfer?.setData("text/plain", "");
	});

	container.addEventListener("dragover", (e) => {
		e.preventDefault();
		const target = (e.target as HTMLElement).closest<HTMLElement>(":scope > *");
		if (!target || !dragEl || target === dragEl) return;
		const rect = target.getBoundingClientRect();
		const after = (e.clientY - rect.top) > rect.height / 2;
		target.parentNode!.insertBefore(dragEl, after ? target.nextSibling : target);
	});

	container.addEventListener("dragend", () => {
		if (dragEl) { delete dragEl.dataset.state; dragEl = null; fireReorder(); }
	});

	for (const item of items()) item.setAttribute("draggable", "true");

	// Keyboard pickup.
	container.addEventListener("keydown", (e) => {
		const active = document.activeElement;
		if (!(active instanceof HTMLElement) || active.parentElement !== container) return;

		if (e.key === " " || e.key === "Enter") {
			e.preventDefault();
			if (pickedKeyboard) {
				delete pickedKeyboard.dataset.state;
				pickedKeyboard = null;
				fireReorder();
			} else {
				pickedKeyboard = active;
				active.dataset.state = "picked";
			}
			return;
		}
		if (pickedKeyboard && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
			e.preventDefault();
			const sibling = e.key === "ArrowUp" ? pickedKeyboard.previousElementSibling : pickedKeyboard.nextElementSibling;
			if (sibling) {
				container.insertBefore(pickedKeyboard, e.key === "ArrowUp" ? sibling : sibling.nextSibling);
				pickedKeyboard.focus();
			}
		}
		if (e.key === "Escape" && pickedKeyboard) {
			delete pickedKeyboard.dataset.state;
			pickedKeyboard = null;
		}
	});

	// Make children focusable.
	for (const item of items()) {
		if (!item.hasAttribute("tabindex")) item.setAttribute("tabindex", "0");
	}
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	new MutationObserver(init).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

export {};

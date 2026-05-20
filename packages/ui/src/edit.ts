// data-edit on a cell — Enter / F2 enters edit mode; Esc cancels;
// Enter / Tab commits with a `change` event.

function init() {
	document.querySelectorAll<HTMLElement>("[data-edit]:not([data-edit-wired])").forEach(wire);
}

function wire(cell: HTMLElement) {
	cell.dataset.editWired = "true";

	function activate() {
		const original = cell.textContent ?? "";
		const input    = document.createElement("input");
		input.type     = "text";
		input.value    = original;
		input.style.cssText = "all: inherit; width: 100%; outline: 1px solid currentColor";
		cell.replaceChildren(input);
		input.focus();
		input.select();

		function commit() {
			cell.textContent = input.value;
			cell.dispatchEvent(new CustomEvent("change", { detail: { value: input.value, previous: original } }));
		}
		function cancel() {
			cell.textContent = original;
		}

		input.addEventListener("blur", commit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				commit();
			} else if (e.key === "Escape") {
				e.preventDefault();
				cancel();
			}
		});
	}

	cell.addEventListener("dblclick", activate);
	cell.addEventListener("keydown", (e) => {
		if (document.activeElement !== cell) return;
		if (e.key === "Enter" || e.key === "F2") {
			e.preventDefault();
			activate();
		}
	});

	if (!cell.hasAttribute("tabindex")) cell.setAttribute("tabindex", "0");
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	new MutationObserver(init).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

export {};

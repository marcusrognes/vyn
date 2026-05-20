// data-focus-trap — constrain Tab focus within the element. For
// modals, prefer <dialog>.showModal() which traps natively; this
// behavior is for non-modal drawers and custom overlays.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function init() {
	document.querySelectorAll<HTMLElement>("[data-focus-trap]:not([data-ft-wired])").forEach(wire);
}

function wire(el: HTMLElement) {
	el.dataset.ftWired = "true";
	let lastFocus: HTMLElement | null = null;

	function focusable(): HTMLElement[] {
		return [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
	}

	function activate() {
		lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const initialSel = el.dataset.focusTrapInitial;
		const initial = initialSel ? el.querySelector<HTMLElement>(initialSel) : focusable()[0];
		initial?.focus();
	}

	function deactivate() {
		if ((el.dataset.focusTrapReturn ?? "true") === "true") lastFocus?.focus();
	}

	function visible(): boolean {
		return el.offsetParent !== null && !el.hasAttribute("hidden");
	}

	let active = false;
	const observer = new MutationObserver(() => {
		const v = visible();
		if (v && !active) { active = true; activate(); }
		else if (!v && active) { active = false; deactivate(); }
	});
	observer.observe(el, { attributes: true, attributeFilter: ["hidden", "style"] });

	if (visible()) { active = true; activate(); }

	el.addEventListener("keydown", (e) => {
		if (e.key !== "Tab") return;
		const list = focusable();
		if (!list.length) { e.preventDefault(); return; }
		const first = list[0];
		const last  = list[list.length - 1];
		if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
		if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
	});
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	new MutationObserver(init).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

export {};

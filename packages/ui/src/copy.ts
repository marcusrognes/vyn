// data-copy — clicking copies the named target's text to clipboard
// and flashes a data-state="copied" attribute for 1.5s.

import { live } from "./live.ts";

function init() {
	document.querySelectorAll<HTMLElement>("[data-copy]:not([data-copy-wired])").forEach(wire);
}

function wire(el: HTMLElement) {
	el.dataset.copyWired = "true";
	el.addEventListener("click", async (e) => {
		e.preventDefault();
		const targetSel = el.dataset.copy!;
		const target = targetSel ? document.querySelector<HTMLElement>(targetSel) : el;
		const text = target?.innerText ?? target?.textContent ?? "";
		try {
			await navigator.clipboard.writeText(text);
			el.dataset.state = "copied";
			live("Copied");
			setTimeout(() => delete el.dataset.state, 1500);
		} catch {
			live("Copy failed", { assertive: true });
		}
	});
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	new MutationObserver(init).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

export {};

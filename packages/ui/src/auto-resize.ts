// data-auto-resize on a <textarea> — grows with content. Falls back
// to JS measurement; Chromium has `field-sizing: content` CSS but
// it's not yet Baseline.

function init() {
	document.querySelectorAll<HTMLTextAreaElement>(
		"textarea[data-auto-resize]:not([data-ar-wired])",
	).forEach(wire);
}

function wire(ta: HTMLTextAreaElement) {
	ta.dataset.arWired = "true";
	const minRows = Number(ta.dataset.minRows ?? 1);
	const maxRows = Number(ta.dataset.maxRows ?? 20);

	function resize() {
		ta.style.height = "auto";
		const lineHeight = parseInt(getComputedStyle(ta).lineHeight, 10) || 20;
		const minH = lineHeight * minRows;
		const maxH = lineHeight * maxRows;
		const h = Math.min(Math.max(ta.scrollHeight, minH), maxH);
		ta.style.height = `${h}px`;
		ta.style.overflowY = ta.scrollHeight > maxH ? "auto" : "hidden";
	}
	resize();
	ta.addEventListener("input", resize);
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

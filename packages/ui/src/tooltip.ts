// data-tooltip-for — show a tooltip element when its target is
// hovered (after a delay) or focused (immediately). Esc dismisses.

function init() {
	document.querySelectorAll<HTMLElement>(
		"[data-tooltip-for]:not([data-tt-wired])",
	).forEach(wire);
}

function wire(tip: HTMLElement) {
	tip.dataset.ttWired = "true";
	const targetId = tip.dataset.tooltipFor!;
	const delay = Number(tip.dataset.tooltipDelay ?? 400);
	const targetMaybe = document.getElementById(targetId);
	if (!targetMaybe) return;
	const target: HTMLElement = targetMaybe;

	tip.setAttribute("role", "tooltip");
	tip.dataset.state = "hidden";
	tip.style.position = tip.style.position || "absolute";
	target.setAttribute(
		"aria-describedby",
		tip.id || (tip.id = `tip_${targetId}`),
	);

	let timer: ReturnType<typeof setTimeout> | null = null;

	function show() {
		tip.dataset.state = "visible";
		positionNear(tip, target);
	}
	function hide() {
		tip.dataset.state = "hidden";
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	target.addEventListener("mouseenter", () => {
		timer = setTimeout(show, delay);
	});
	target.addEventListener("mouseleave", hide);
	target.addEventListener("focus", show);
	target.addEventListener("blur", hide);
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") hide();
	});
}

function positionNear(tip: HTMLElement, target: HTMLElement) {
	const t = target.getBoundingClientRect();
	const e = tip.getBoundingClientRect();
	tip.style.position = "fixed";
	tip.style.top = `${t.bottom + 6}px`;
	tip.style.left = `${Math.max(8, t.left + (t.width - e.width) / 2)}px`;
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

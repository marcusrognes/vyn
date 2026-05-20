// data-anchor — JS-fallback floating positioning. Modern browsers
// with CSS Anchor Positioning can do this in pure CSS; this is the
// fallback + composition surface.

function init() {
	document.querySelectorAll<HTMLElement>("[data-anchor]:not([data-anc-wired])").forEach(wire);
}

function wire(el: HTMLElement) {
	el.dataset.ancWired = "true";
	const anchorId  = el.dataset.anchor!;
	const placement = el.dataset.placement ?? "bottom-start";
	const offset    = Number(el.dataset.offset ?? 4);

	const anchor = document.getElementById(anchorId);
	if (!anchor) return;

	function reposition() {
		const a = anchor.getBoundingClientRect();
		const e = el.getBoundingClientRect();
		let top = 0, left = 0;
		switch (placement) {
			case "bottom":       top = a.bottom + offset; left = a.left + (a.width - e.width) / 2; break;
			case "bottom-start": top = a.bottom + offset; left = a.left; break;
			case "bottom-end":   top = a.bottom + offset; left = a.right - e.width; break;
			case "top":          top = a.top - e.height - offset; left = a.left + (a.width - e.width) / 2; break;
			case "top-start":    top = a.top - e.height - offset; left = a.left; break;
			case "top-end":      top = a.top - e.height - offset; left = a.right - e.width; break;
			case "right-start":  top = a.top; left = a.right + offset; break;
			case "left-start":   top = a.top; left = a.left - e.width - offset; break;
			default:             top = a.bottom + offset; left = a.left;
		}
		// Clamp into viewport.
		top  = Math.max(0, Math.min(top,  window.innerHeight - e.height));
		left = Math.max(0, Math.min(left, window.innerWidth  - e.width));
		el.style.position = "fixed";
		el.style.top      = `${top}px`;
		el.style.left     = `${left}px`;
		el.dataset.state  = `placement-${placement.split("-")[0]}`;
		el.dispatchEvent(new CustomEvent("reposition", { detail: { placement } }));
	}

	reposition();
	const ro = new ResizeObserver(reposition);
	ro.observe(anchor);
	ro.observe(el);
	window.addEventListener("scroll",  reposition, true);
	window.addEventListener("resize",  reposition);
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	new MutationObserver(init).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

export {};

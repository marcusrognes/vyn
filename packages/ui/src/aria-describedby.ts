// data-describedby — pairs the element with a sibling descriptor.
// Adds `aria-describedby="<descriptor-id>"`. Optionally watches
// :invalid state to toggle description visibility.

function init() {
	document.querySelectorAll<HTMLElement>(
		"[data-describedby]:not([data-db-wired])",
	).forEach(wire);
}

function wire(el: HTMLElement) {
	el.dataset.dbWired = "true";
	const descId = el.dataset.describedby!;
	const desc = document.getElementById(descId);
	if (!desc) return;

	const invalidOnly = el.dataset.describedbyInvalidOnly === "true";

	function update() {
		const showWhenInvalid = invalidOnly &&
			(el as HTMLInputElement).validity?.valid;
		if (showWhenInvalid) {
			el.removeAttribute("aria-describedby");
			desc!.dataset.state = "hidden";
		} else {
			el.setAttribute("aria-describedby", descId);
			desc!.dataset.state = "shown";
		}
	}
	update();
	el.addEventListener("input", update);
	el.addEventListener("blur", update);
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

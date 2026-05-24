// data-form-associated on a container — mirrors data-value to a
// hidden <input name=...> so the wrapping <form> submits it.
// For custom-element widgets, use native ElementInternals; this
// behavior is for plain HTML composers.

function init() {
	document.querySelectorAll<HTMLElement>(
		"[data-form-associated]:not([data-fa-wired])",
	).forEach(wire);
}

function wire(el: HTMLElement) {
	el.dataset.faWired = "true";
	const name = el.dataset.name ?? el.dataset.formAssociated ?? "";
	if (!name) return;

	const hidden = document.createElement("input");
	hidden.type = "hidden";
	hidden.name = name;
	hidden.value = el.dataset.value ?? "";
	el.appendChild(hidden);

	// Sync when data-value changes.
	const observer = new MutationObserver(() => {
		hidden.value = el.dataset.value ?? "";
	});
	observer.observe(el, { attributes: true, attributeFilter: ["data-value"] });
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

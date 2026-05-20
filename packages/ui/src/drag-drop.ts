// data-draggable / data-dropzone — typed drag-and-drop. Source carries
// data-type; zone declares data-accepts as a space-separated list.

function init() {
	document.querySelectorAll<HTMLElement>("[data-draggable]:not([data-dd-src-wired])").forEach(wireSource);
	document.querySelectorAll<HTMLElement>("[data-dropzone]:not([data-dd-zone-wired])").forEach(wireZone);
}

function wireSource(el: HTMLElement) {
	el.dataset.ddSrcWired = "true";
	el.setAttribute("draggable", "true");
	el.addEventListener("dragstart", (e) => {
		const type = el.dataset.draggable!;
		const data = el.dataset.payload ?? "";
		e.dataTransfer?.setData("application/x-vyn-type", type);
		e.dataTransfer?.setData("application/x-vyn-data", data);
		e.dataTransfer?.setData("text/plain", data || el.textContent || "");
		el.dataset.state = "dragging";
	});
	el.addEventListener("dragend", () => delete el.dataset.state);
}

function wireZone(zone: HTMLElement) {
	zone.dataset.ddZoneWired = "true";
	const accepts = (zone.dataset.accepts ?? "").split(/\s+/).filter(Boolean);

	zone.addEventListener("dragover", (e) => {
		const type = e.dataTransfer?.types.includes("application/x-vyn-type")
			? e.dataTransfer.getData("application/x-vyn-type")
			: null;
		// During dragover the actual data isn't readable on some browsers, but
		// the type stays available in dataTransfer.types. Treat any drag as a
		// candidate; the drop handler enforces the contract.
		e.preventDefault();
		zone.dataset.state = "over";
	});
	zone.addEventListener("dragleave", () => delete zone.dataset.state);
	zone.addEventListener("drop", (e) => {
		e.preventDefault();
		delete zone.dataset.state;
		const type = e.dataTransfer?.getData("application/x-vyn-type") ?? "";
		const data = e.dataTransfer?.getData("application/x-vyn-data") ?? "";
		if (accepts.length && !accepts.includes(type)) {
			zone.dispatchEvent(new CustomEvent("rejected", { detail: { type, data } }));
			return;
		}
		zone.dispatchEvent(new CustomEvent("drop", { detail: { type, data } }));
	});
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	new MutationObserver(init).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

export {};

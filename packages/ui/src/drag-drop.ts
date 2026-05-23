// data-draggable / data-dropzone — typed drag-and-drop with selection-aware
// multi-drag.
//
// Source:
//   data-draggable="<type>"     // e.g. "node"
//   data-value="<id>"           // single payload (preferred; works with data-select)
//   data-payload="..."          // legacy single string payload
//
// Zone:
//   data-dropzone
//   data-accepts="node task"    // space-separated list of accepted types
//
// Selection-aware multi-drag:
//   If the source is inside an ancestor [data-select="multiple"] and the
//   source's own data-value is currently in container.dataset.value (CSV),
//   then ALL selected peers are dragged together. Otherwise just the source.
//
// Drop event:
//   CustomEvent("drop") on the zone, detail = {
//     type:  string;
//     items: string[];        // always an array (1+ entries)
//     data:  string;          // raw payload as written to dataTransfer
//   }
//
// During drag, every peer in the payload is marked data-state="dragging" so
// CSS can dim them.

const MIME_TYPE  = "application/x-vyn-type";
const MIME_DATA  = "application/x-vyn-data";
const MIME_MULTI = "application/x-vyn-multi";

function init() {
	document.querySelectorAll<HTMLElement>("[data-draggable]:not([data-dd-src-wired])").forEach(wireSource);
	document.querySelectorAll<HTMLElement>("[data-dropzone]:not([data-dd-zone-wired])").forEach(wireZone);
}

function wireSource(el: HTMLElement) {
	el.dataset.ddSrcWired = "true";
	el.setAttribute("draggable", "true");

	el.addEventListener("dragstart", (e) => {
		const type = el.dataset.draggable!;
		const own  = el.dataset.value ?? el.dataset.payload ?? "";
		const { items, peers } = resolveSelectionPayload(el, own);

		const data = items.length > 1 ? JSON.stringify(items) : (items[0] ?? "");
		e.dataTransfer?.setData(MIME_TYPE, type);
		e.dataTransfer?.setData(MIME_DATA, data);
		if (items.length > 1) e.dataTransfer?.setData(MIME_MULTI, "1");
		e.dataTransfer?.setData("text/plain", items.join(","));

		for (const p of peers) p.dataset.state = "dragging";
	});

	el.addEventListener("dragend", () => {
		delete el.dataset.state;
		const own  = el.dataset.value ?? el.dataset.payload ?? "";
		const { peers } = resolveSelectionPayload(el, own);
		for (const p of peers) delete p.dataset.state;
	});
}

function resolveSelectionPayload(el: HTMLElement, fallback: string): { items: string[]; peers: HTMLElement[] } {
	const container = el.closest<HTMLElement>("[data-select='multiple']");
	if (!container) return { items: fallback ? [fallback] : [], peers: el ? [el] : [] };

	const csv = container.dataset.value ?? "";
	const selected = csv ? csv.split(",").filter(Boolean) : [];
	if (selected.length === 0 || !selected.includes(fallback)) {
		return { items: fallback ? [fallback] : [], peers: el ? [el] : [] };
	}

	const peers: HTMLElement[] = [];
	for (const id of selected) {
		const sel = (globalThis as any).CSS?.escape
			? `[data-value="${CSS.escape(id)}"]`
			: `[data-value="${id.replace(/"/g, "\\\"")}"]`;
		const peer = container.querySelector<HTMLElement>(sel);
		if (peer) peers.push(peer);
	}
	return { items: selected, peers };
}

function wireZone(zone: HTMLElement) {
	zone.dataset.ddZoneWired = "true";
	const accepts = (zone.dataset.accepts ?? "").split(/\s+/).filter(Boolean);

	zone.addEventListener("dragover", (e) => {
		const type = e.dataTransfer?.types.includes(MIME_TYPE)
			? e.dataTransfer.getData(MIME_TYPE)
			: null;
		if (accepts.length && type && !accepts.includes(type)) return;
		e.preventDefault();
		zone.dataset.state = "over";
	});

	zone.addEventListener("dragleave", () => delete zone.dataset.state);

	zone.addEventListener("drop", (e) => {
		e.preventDefault();
		delete zone.dataset.state;
		const type  = e.dataTransfer?.getData(MIME_TYPE) ?? "";
		const data  = e.dataTransfer?.getData(MIME_DATA) ?? "";
		const multi = e.dataTransfer?.getData(MIME_MULTI) === "1";

		if (accepts.length && !accepts.includes(type)) {
			zone.dispatchEvent(new CustomEvent("rejected", { detail: { type, data } }));
			return;
		}
		let items: string[];
		if (multi) {
			try { items = JSON.parse(data) as string[]; }
			catch { items = data ? [data] : []; }
		} else {
			items = data ? [data] : [];
		}
		zone.dispatchEvent(new CustomEvent("drop", { detail: { type, items, data } }));
	});
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	new MutationObserver(init).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

export {};

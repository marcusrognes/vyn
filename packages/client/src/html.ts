// Vanilla tagged-template literal that produces an Html sentinel.
// render(el, html`...`) sets el.innerHTML. Interpolations are escaped
// unless they're already Html (so html`<p>${html`<span>x</span>`}</p>`
// works without double-escaping).
//
// This is intentionally not a reactive engine — Vyn's render() is
// imperative. For granular updates write addEventListener and DOM
// mutations yourself; for whole-component refresh, call render()
// again with new html`...`.

export type Html = { __html: true; source: string };

function isHtml(v: unknown): v is Html {
	return typeof v === "object" && v !== null && (v as { __html?: unknown }).__html === true;
}

function escape(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function interp(v: unknown): string {
	if (v === null || v === undefined || v === false) return "";
	if (v === true) return "true";
	if (Array.isArray(v)) return v.map(interp).join("");
	if (isHtml(v)) return v.source;
	if (v instanceof Date) return escape(v.toLocaleString());
	if (typeof v === "object") return escape(JSON.stringify(v));
	return escape(String(v));
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
	let out = "";
	for (let i = 0; i < strings.length; i++) {
		out += strings[i];
		if (i < values.length) out += interp(values[i]);
	}
	return { __html: true, source: out };
}

export function render(el: Element, content: Html | Html[] | string | null): void {
	if (content === null) { el.innerHTML = ""; return; }
	if (Array.isArray(content)) {
		el.innerHTML = content.map((c) => (isHtml(c) ? c.source : interp(c))).join("");
		return;
	}
	if (typeof content === "string") { el.textContent = content; return; }
	el.innerHTML = content.source;
}

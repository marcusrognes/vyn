// <v-table columns='[...]' rows='[...]'> — a sortable data table.
// JSON-driven; renders a native <table> so semantics + a11y are free.

type Column = { key: string; label?: string; sortable?: boolean };

class VTableElement extends HTMLElement {
	#cols: Column[] = [];
	#rows: Record<string, unknown>[] = [];
	#sortKey?:   string;
	#sortDir:    "asc" | "desc" = "asc";

	static get observedAttributes() { return ["columns", "rows"]; }

	connectedCallback() {
		this.style.display = "block";
		this.#refreshFromAttrs();
		this.render();
	}
	attributeChangedCallback() {
		this.#refreshFromAttrs();
		this.render();
	}
	#refreshFromAttrs() {
		try { this.#cols = JSON.parse(this.getAttribute("columns") ?? "[]"); } catch { this.#cols = []; }
		try { this.#rows = JSON.parse(this.getAttribute("rows") ?? "[]"); } catch { this.#rows = []; }
	}

	set columns(c: Column[]) { this.#cols = c; this.render(); }
	set rows(r: Record<string, unknown>[]) { this.#rows = r; this.render(); }
	get rows() { return this.#rows; }

	render() {
		const rows = [...this.#rows];
		if (this.#sortKey) {
			rows.sort((a, b) => {
				const av = a[this.#sortKey!] as unknown;
				const bv = b[this.#sortKey!] as unknown;
				if (av === bv) return 0;
				const cmp = (av as never) < (bv as never) ? -1 : 1;
				return this.#sortDir === "asc" ? cmp : -cmp;
			});
		}

		this.innerHTML = `
			<table style="width:100%;border-collapse:collapse;font-family:system-ui,sans-serif">
				<thead>
					<tr>
						${this.#cols.map((c) => `
							<th style="text-align:left;padding:0.5rem;border-bottom:2px solid #e2e8f0;${c.sortable ? "cursor:pointer" : ""}"
							    ${c.sortable ? `data-sort-key="${escape(c.key)}"` : ""}
							    aria-sort="${this.#sortKey === c.key ? (this.#sortDir === "asc" ? "ascending" : "descending") : "none"}">
								${escape(c.label ?? c.key)}
								${this.#sortKey === c.key ? (this.#sortDir === "asc" ? " ▲" : " ▼") : ""}
							</th>
						`).join("")}
					</tr>
				</thead>
				<tbody>
					${rows.map((row) => `
						<tr>
							${this.#cols.map((c) => `<td style="padding:0.5rem;border-bottom:1px solid #e2e8f0">${escape(String(row[c.key] ?? ""))}</td>`).join("")}
						</tr>
					`).join("")}
				</tbody>
			</table>
		`;

		this.querySelectorAll<HTMLElement>("th[data-sort-key]").forEach((th) => {
			th.addEventListener("click", () => {
				const k = th.dataset.sortKey!;
				if (this.#sortKey === k) this.#sortDir = this.#sortDir === "asc" ? "desc" : "asc";
				else { this.#sortKey = k; this.#sortDir = "asc"; }
				this.render();
				this.dispatchEvent(new CustomEvent("sort", { detail: { key: k, direction: this.#sortDir } }));
			});
		});
	}
}

function escape(s: string): string {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

if (typeof window !== "undefined" && !customElements.get("v-table")) {
	customElements.define("v-table", VTableElement);
}

export {};

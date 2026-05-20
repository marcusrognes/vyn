// <v-grid columns="N" rows="M"> — focusable cell grid with arrow-key
// navigation. Cells are slotted children; the grid manages focus and
// emits a `cellfocus` event when the active cell changes.

class VGridElement extends HTMLElement {
	#cols = 1;
	#active = 0;

	connectedCallback() {
		this.#cols = Number(this.getAttribute("columns") ?? "1");
		this.style.display = "grid";
		this.style.gridTemplateColumns = `repeat(${this.#cols}, 1fr)`;
		this.setAttribute("role", "grid");
		const cells = this.#cells();
		cells.forEach((c, i) => {
			c.setAttribute("role", "gridcell");
			c.setAttribute("tabindex", i === 0 ? "0" : "-1");
		});
		this.addEventListener("keydown", (e) => this.#onKey(e));
		this.addEventListener("focus",   (e) => this.#cells()[this.#active]?.focus(), true);
	}

	#cells(): HTMLElement[] {
		return [...this.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
	}

	#focus(i: number) {
		const cells = this.#cells();
		if (i < 0 || i >= cells.length) return;
		cells[this.#active]?.setAttribute("tabindex", "-1");
		this.#active = i;
		cells[i].setAttribute("tabindex", "0");
		cells[i].focus();
		this.dispatchEvent(new CustomEvent("cellfocus", { detail: { index: i, cell: cells[i] } }));
	}

	#onKey(e: KeyboardEvent) {
		const cells = this.#cells();
		const total = cells.length;
		const cur   = this.#active;
		switch (e.key) {
			case "ArrowRight": e.preventDefault(); this.#focus(Math.min(cur + 1, total - 1)); break;
			case "ArrowLeft":  e.preventDefault(); this.#focus(Math.max(cur - 1, 0)); break;
			case "ArrowDown":  e.preventDefault(); this.#focus(Math.min(cur + this.#cols, total - 1)); break;
			case "ArrowUp":    e.preventDefault(); this.#focus(Math.max(cur - this.#cols, 0)); break;
			case "Home":       e.preventDefault(); this.#focus(0); break;
			case "End":        e.preventDefault(); this.#focus(total - 1); break;
		}
	}
}

if (typeof window !== "undefined" && !customElements.get("v-grid")) {
	customElements.define("v-grid", VGridElement);
}

export {};

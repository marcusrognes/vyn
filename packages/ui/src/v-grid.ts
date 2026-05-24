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
		this.addEventListener("focus", (e) => {
			// Only redirect when the grid host itself takes focus (e.g.
			// programmatic .focus()). Skip when a descendant cell got the
			// focus — otherwise a click on cell N would snap back to cell #active.
			if (e.target !== this) return;
			this.#cells()[this.#active]?.focus();
		}, true);
		this.addEventListener("focusin", (e) => {
			const i = this.#cells().indexOf(e.target as HTMLElement);
			if (i >= 0) this.#activate(i);
		});
		this.addEventListener("click", (e) => {
			const cells = this.#cells();
			const cell = cells.find((c) => c.contains(e.target as Node));
			if (cell) this.#focus(cells.indexOf(cell));
		});
	}

	#cells(): HTMLElement[] {
		return [...this.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
	}

	#activate(i: number) {
		const cells = this.#cells();
		if (i < 0 || i >= cells.length || i === this.#active) return;
		cells[this.#active]?.setAttribute("tabindex", "-1");
		this.#active = i;
		cells[i].setAttribute("tabindex", "0");
		this.dispatchEvent(
			new CustomEvent("cellfocus", { detail: { index: i, cell: cells[i] } }),
		);
	}

	#focus(i: number) {
		this.#activate(i);
		this.#cells()[i]?.focus();
	}

	#onKey(e: KeyboardEvent) {
		const cells = this.#cells();
		const total = cells.length;
		const cur = this.#active;
		switch (e.key) {
			case "ArrowRight":
				e.preventDefault();
				this.#focus(Math.min(cur + 1, total - 1));
				break;
			case "ArrowLeft":
				e.preventDefault();
				this.#focus(Math.max(cur - 1, 0));
				break;
			case "ArrowDown":
				e.preventDefault();
				this.#focus(Math.min(cur + this.#cols, total - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				this.#focus(Math.max(cur - this.#cols, 0));
				break;
			case "Home":
				e.preventDefault();
				this.#focus(0);
				break;
			case "End":
				e.preventDefault();
				this.#focus(total - 1);
				break;
		}
	}
}

if (typeof window !== "undefined" && !customElements.get("v-grid")) {
	customElements.define("v-grid", VGridElement);
}

export {};

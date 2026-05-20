// <v-combobox value="" placeholder="..."> — text input with a popover
// listbox of suggestions. Suggestions come from a `data-suggestions`
// JSON attribute, OR via the .setSuggestions() method, OR via the
// "fetch" event that the element emits while the user types.

type Suggestion = { value: string; label?: string };

class VComboboxElement extends HTMLElement {
	static formAssociated = true;
	#input!:    HTMLInputElement;
	#listbox!:  HTMLUListElement;
	#suggestions: Suggestion[] = [];
	#highlight = 0;

	connectedCallback() {
		this.style.position = this.style.position || "relative";
		this.style.display  = "inline-block";

		this.innerHTML = `
			<input type="text" autocomplete="off"
			       role="combobox" aria-expanded="false"
			       style="width:100%;padding:0.5rem 0.75rem;border:1px solid #cbd5e1;border-radius:0.375rem;font-size:1rem">
			<ul role="listbox" hidden
			    style="position:absolute;top:100%;left:0;right:0;margin:2px 0 0;padding:0;list-style:none;
			           background:white;border:1px solid #cbd5e1;border-radius:0.375rem;max-height:14rem;overflow:auto;z-index:10"></ul>
		`;
		this.#input   = this.querySelector("input")!;
		this.#listbox = this.querySelector("ul")!;

		const placeholder = this.getAttribute("placeholder");
		if (placeholder) this.#input.placeholder = placeholder;
		const initial = this.getAttribute("value");
		if (initial) this.#input.value = initial;

		const raw = this.getAttribute("data-suggestions");
		if (raw) { try { this.#suggestions = JSON.parse(raw); } catch { /* ignore */ } }

		this.#input.addEventListener("input", () => {
			this.dispatchEvent(new CustomEvent("fetch", { detail: { query: this.#input.value } }));
			this.#open();
		});
		this.#input.addEventListener("focus", () => this.#open());
		this.#input.addEventListener("blur",  () => setTimeout(() => this.#close(), 100));
		this.#input.addEventListener("keydown", (e) => this.#onKey(e));

		this.#listbox.addEventListener("click", (e) => {
			const li = (e.target as HTMLElement).closest<HTMLLIElement>("li[data-value]");
			if (li) this.#select(li.dataset.value!);
		});
	}

	setSuggestions(s: Suggestion[]) {
		this.#suggestions = s;
		this.#render();
	}

	get value() { return this.#input?.value ?? ""; }
	set value(v: string) { if (this.#input) this.#input.value = v; }

	#open() {
		this.#render();
		this.#listbox.hidden = false;
		this.#input.setAttribute("aria-expanded", "true");
	}
	#close() {
		this.#listbox.hidden = true;
		this.#input.setAttribute("aria-expanded", "false");
	}
	#render() {
		this.#listbox.innerHTML = this.#suggestions.map((s, i) => `
			<li role="option" data-value="${escape(s.value)}"
			    aria-selected="${i === this.#highlight}"
			    style="padding:0.5rem 0.75rem;cursor:pointer;${i === this.#highlight ? "background:#eef2ff" : ""}">
				${escape(s.label ?? s.value)}
			</li>
		`).join("");
	}
	#onKey(e: KeyboardEvent) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			this.#highlight = Math.min(this.#highlight + 1, this.#suggestions.length - 1);
			this.#render();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			this.#highlight = Math.max(this.#highlight - 1, 0);
			this.#render();
		} else if (e.key === "Enter") {
			const s = this.#suggestions[this.#highlight];
			if (s) { e.preventDefault(); this.#select(s.value); }
		} else if (e.key === "Escape") {
			this.#close();
		}
	}
	#select(value: string) {
		this.#input.value = value;
		this.dispatchEvent(new CustomEvent("change", { detail: { value } }));
		this.#close();
	}
}

function escape(s: string): string {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

if (typeof window !== "undefined" && !customElements.get("v-combobox")) {
	customElements.define("v-combobox", VComboboxElement);
}

export {};

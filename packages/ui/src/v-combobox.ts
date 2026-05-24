// <v-combobox value="" placeholder="..."> — text input with a popover
// listbox of suggestions. Suggestions come from a `data-suggestions`
// JSON attribute, OR via the .setSuggestions() method, OR via the
// "fetch" event that the element emits while the user types.

type Suggestion = { value: string; label?: string };

class VComboboxElement extends HTMLElement {
	static formAssociated = true;
	#input!:    HTMLInputElement;
	#listbox!:  HTMLUListElement;
	#internals: ElementInternals;
	// Source list (every option the component knows about) and the
	// query-filtered subset that's actually displayed + navigated.
	// Highlight is an index into #filtered, not #source.
	#source: Suggestion[] = [];
	#filtered: Suggestion[] = [];
	#highlight = 0;
	// The committed value — the `value` of the suggestion the user
	// picked. Distinct from the input's displayed text, which is the
	// suggestion's `label`. Falls back to free-text input.value when
	// the user is typing and hasn't picked from the list.
	#selectedValue: string | undefined;

	constructor() {
		super();
		this.#internals = this.attachInternals();
	}

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
		if (initial) {
			this.#input.value = initial;
			this.#selectedValue = initial;
			this.#internals.setFormValue(initial);
		}

		const raw = this.getAttribute("data-suggestions");
		if (raw) { try { this.#source = JSON.parse(raw); } catch { /* ignore */ } }
		this.#filtered = this.#source;

		this.#input.addEventListener("input", () => {
			// User is typing again — invalidate any prior committed pick
			// and revert to free-text mode. The form value tracks the
			// raw text until they select something.
			this.#selectedValue = undefined;
			this.#internals.setFormValue(this.#input.value);
			// Local substring filter against label or value. Caller can
			// still listen to `fetch` and replace the whole list via
			// setSuggestions() for async / server-driven sources.
			this.#applyFilter();
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
		this.#source = s;
		this.#applyFilter();
	}

	// The committed value (suggestion.value of whatever the user picked)
	// when they picked from the list, or the raw text otherwise.
	get value() { return this.#selectedValue ?? this.#input?.value ?? ""; }
	set value(v: string) {
		const match = this.#source.find((s) => s.value === v);
		if (this.#input) this.#input.value = match?.label ?? v;
		this.#selectedValue = v;
		this.#internals.setFormValue(v);
	}

	#applyFilter() {
		const q = this.#input.value.trim().toLowerCase();
		this.#filtered = q
			? this.#source.filter((s) => {
				const hay = (s.label ?? s.value).toLowerCase();
				return hay.includes(q) || s.value.toLowerCase().includes(q);
			})
			: this.#source;
		// Reset highlight to the first visible option so Enter picks
		// something the user can see, not a stale index that may now
		// point past the end (or to a different option).
		this.#highlight = 0;
		this.#render();
	}
	#open() {
		if (this.#listbox.hidden) this.#render();
		this.#listbox.hidden = false;
		this.#input.setAttribute("aria-expanded", "true");
	}
	#close() {
		this.#listbox.hidden = true;
		this.#input.setAttribute("aria-expanded", "false");
	}
	#render() {
		// Clamp highlight after a list change (e.g. async refresh).
		if (this.#highlight >= this.#filtered.length) this.#highlight = 0;
		this.#listbox.innerHTML = this.#filtered.map((s, i) => `
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
			if (this.#filtered.length === 0) return;
			this.#highlight = Math.min(this.#highlight + 1, this.#filtered.length - 1);
			this.#render();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			this.#highlight = Math.max(this.#highlight - 1, 0);
			this.#render();
		} else if (e.key === "Enter") {
			const s = this.#filtered[this.#highlight];
			if (s) { e.preventDefault(); this.#select(s.value); }
		} else if (e.key === "Escape") {
			this.#close();
		}
	}
	#select(value: string) {
		const s = this.#source.find((s) => s.value === value);
		this.#input.value    = s?.label ?? value;
		this.#selectedValue  = value;
		this.#internals.setFormValue(value);
		this.dispatchEvent(new CustomEvent("change", { detail: { value, label: s?.label ?? value } }));
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

// @vynjs/ui browser bundle — single ESM file. Hand-rolled mirror of
// the @vynjs/ui source so apps can `import "/_vyn/ui.js"` without a
// bundler. Served by @vynjs/server when present.
//
// Side-effects: scans the DOM via MutationObserver and registers
// behaviors + custom elements. Idempotent — multiple imports are
// safe.

// ─── live() ──────────────────────────────────────────────────────────
const REGION_ID = "vyn-live-region";
let politeQueue = [], politeTimer = null;
function ensureRegion() {
	let polite = document.getElementById(REGION_ID + "-polite");
	let assertive = document.getElementById(REGION_ID + "-assertive");
	if (!polite) {
		polite = document.createElement("div");
		polite.id = REGION_ID + "-polite";
		polite.setAttribute("aria-live", "polite");
		polite.setAttribute("aria-atomic", "true");
		polite.style.cssText = "position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden";
		document.body.appendChild(polite);
	}
	if (!assertive) {
		assertive = document.createElement("div");
		assertive.id = REGION_ID + "-assertive";
		assertive.setAttribute("aria-live", "assertive");
		assertive.setAttribute("aria-atomic", "true");
		assertive.style.cssText = "position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden";
		document.body.appendChild(assertive);
	}
	return { polite, assertive };
}
export function live(message, opts = {}) {
	const { polite, assertive } = ensureRegion();
	if (opts.assertive) {
		assertive.textContent = message;
		return;
	}
	politeQueue.push(message);
	if (!politeTimer) {
		politeTimer = setTimeout(() => {
			polite.textContent = politeQueue.shift() ?? "";
			politeTimer = null;
			if (politeQueue.length) live(politeQueue.shift());
		}, 150);
	}
}

if (typeof window !== "undefined") window.vynLive = live;

// ─── Wire scaffolding ────────────────────────────────────────────────
function registerInit(fn) {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", fn);
	} else fn();
	new MutationObserver(fn).observe(document.body ?? document.documentElement, {
		childList: true,
		subtree: true,
	});
}

// ─── keyboard-nav ────────────────────────────────────────────────────
registerInit(() => {
	document.querySelectorAll("[data-keyboard-nav]:not([data-kn-wired])").forEach(
		(container) => {
			container.dataset.knWired = "true";
			const direction = container.dataset.direction ?? "vertical";
			const items = () => [...container.children].filter((c) => c instanceof HTMLElement && !c.hasAttribute("disabled"));
			const move = (delta) => {
				const list = items();
				if (!list.length) return;
				const current = list.indexOf(document.activeElement);
				const next = (current + delta + list.length) % list.length;
				focusItem(list[next]);
			};
			const focusItem = (item) => {
				items().forEach((i) => i.setAttribute("tabindex", "-1"));
				item.setAttribute("tabindex", "0");
				item.focus();
				container.dispatchEvent(
					new CustomEvent("focuschange", { detail: { item } }),
				);
			};
			const list = items();
			list.forEach((i, idx) => i.setAttribute("tabindex", idx === 0 ? "0" : "-1"));
			container.addEventListener("keydown", (e) => {
				const k = e.key;
				if (k === "ArrowDown" && direction !== "horizontal") {
					e.preventDefault();
					move(+1);
				}
				if (k === "ArrowUp" && direction !== "horizontal") {
					e.preventDefault();
					move(-1);
				}
				if (k === "ArrowRight" && direction !== "vertical") {
					e.preventDefault();
					move(+1);
				}
				if (k === "ArrowLeft" && direction !== "vertical") {
					e.preventDefault();
					move(-1);
				}
				if (k === "Home") {
					e.preventDefault();
					focusItem(items()[0]);
				}
				if (k === "End") {
					e.preventDefault();
					const l = items();
					focusItem(l[l.length - 1]);
				}
				if (k === "Enter" || k === " ") {
					const active = document.activeElement;
					if (active && items().includes(active)) {
						e.preventDefault();
						container.dispatchEvent(
							new CustomEvent("activate", { detail: { item: active } }),
						);
					}
				}
			});
		},
	);
});

// ─── select ──────────────────────────────────────────────────────────
registerInit(() => {
	document.querySelectorAll("[data-select]:not([data-sel-wired])").forEach(
		(container) => {
			container.dataset.selWired = "true";
			const mode = container.dataset.select || "single";
			const items = () => [...container.querySelectorAll("[data-value]")];
			const current = () => {
				const v = container.dataset.value ?? "";
				if (!v) return [];
				return mode === "single" ? [v] : v.split(",").filter(Boolean);
			};
			const update = (values) => {
				container.dataset.value = mode === "single" ? (values[0] ?? "") : values.join(",");
				for (const item of items()) {
					item.setAttribute(
						"aria-selected",
						values.includes(item.dataset.value) ? "true" : "false",
					);
				}
				container.dispatchEvent(
					new CustomEvent("change", {
						detail: { value: mode === "single" ? values[0] : values },
					}),
				);
			};
			update(current());
			container.addEventListener("click", (e) => {
				const item = e.target.closest("[data-value]");
				if (!item || !container.contains(item)) return;
				const v = item.dataset.value;
				const cur = current();
				if (mode === "single") update([v]);
				else {
					const set = new Set(cur);
					set.has(v) ? set.delete(v) : set.add(v);
					update([...set]);
				}
			});
			container.addEventListener("activate", (e) => {
				const v = e.detail?.item?.dataset?.value;
				if (!v) return;
				const cur = current();
				if (mode === "single") update([v]);
				else {
					const set = new Set(cur);
					set.has(v) ? set.delete(v) : set.add(v);
					update([...set]);
				}
			});
		},
	);
});

// ─── dismiss ─────────────────────────────────────────────────────────
registerInit(() => {
	document.querySelectorAll("[data-dismiss]:not([data-dis-wired])").forEach(
		(el) => {
			el.dataset.disWired = "true";
			const triggers = (el.dataset.dismissOn ?? "escape outside").split(/\s+/);
			const fire = (reason) => {
				const ev = new CustomEvent("dismiss", {
					detail: { reason },
					cancelable: true,
				});
				el.dispatchEvent(ev);
				if (!ev.defaultPrevented) {
					el.dispatchEvent(
						new CustomEvent("dismissed", { detail: { reason } }),
					);
				}
			};
			if (triggers.includes("escape")) {
				document.addEventListener("keydown", (e) => {
					if (e.key === "Escape" && el.contains(document.activeElement)) {
						e.preventDefault();
						fire("escape");
					}
				});
			}
			if (triggers.includes("outside")) {
				document.addEventListener("pointerdown", (e) => {
					if (!el.contains(e.target)) fire("outside");
				});
			}
			if (triggers.includes("focus-out")) {
				el.addEventListener("focusout", () =>
					setTimeout(() => {
						if (!el.contains(document.activeElement)) fire("focus-out");
					}, 0));
			}
		},
	);
});

// ─── typeahead ───────────────────────────────────────────────────────
registerInit(() => {
	document.querySelectorAll("[data-typeahead]:not([data-ta-wired])").forEach(
		(container) => {
			container.dataset.taWired = "true";
			const timeoutMs = Number(container.dataset.typeaheadTimeout ?? 500);
			let buffer = "", lastKey = 0;
			container.addEventListener("keydown", (e) => {
				if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
				const now = Date.now();
				if (now - lastKey > timeoutMs) buffer = "";
				buffer += e.key.toLowerCase();
				lastKey = now;
				const list = [...container.children];
				const start = list.indexOf(document.activeElement);
				const order = [...list.slice(start + 1), ...list.slice(0, start + 1)];
				const hit = order.find((el) => (el.textContent ?? "").trim().toLowerCase().startsWith(buffer));
				if (hit) {
					e.preventDefault();
					list.forEach((i) => i.setAttribute("tabindex", "-1"));
					hit.setAttribute("tabindex", "0");
					hit.focus();
				}
			});
		},
	);
});

// ─── copy ────────────────────────────────────────────────────────────
registerInit(() => {
	document.querySelectorAll("[data-copy]:not([data-copy-wired])").forEach(
		(el) => {
			el.dataset.copyWired = "true";
			el.addEventListener("click", async (e) => {
				e.preventDefault();
				const sel = el.dataset.copy;
				const target = sel ? document.querySelector(sel) : el;
				const text = target?.innerText ?? target?.textContent ?? "";
				try {
					await navigator.clipboard.writeText(text);
					el.dataset.state = "copied";
					live("Copied");
					setTimeout(() => delete el.dataset.state, 1500);
				} catch {
					live("Copy failed", { assertive: true });
				}
			});
		},
	);
});

// ─── auto-resize ─────────────────────────────────────────────────────
registerInit(() => {
	document.querySelectorAll("textarea[data-auto-resize]:not([data-ar-wired])")
		.forEach((ta) => {
			ta.dataset.arWired = "true";
			const minRows = Number(ta.dataset.minRows ?? 1);
			const maxRows = Number(ta.dataset.maxRows ?? 20);
			const resize = () => {
				ta.style.height = "auto";
				const lh = parseInt(getComputedStyle(ta).lineHeight, 10) || 20;
				const h = Math.min(
					Math.max(ta.scrollHeight, lh * minRows),
					lh * maxRows,
				);
				ta.style.height = `${h}px`;
				ta.style.overflowY = ta.scrollHeight > lh * maxRows ? "auto" : "hidden";
			};
			resize();
			ta.addEventListener("input", resize);
		});
});

// ─── sort ────────────────────────────────────────────────────────────
registerInit(() => {
	document.querySelectorAll("[data-sort]:not([data-srt-wired])").forEach(
		(container) => {
			container.dataset.srtWired = "true";
			const multi = container.dataset.sortMulti === "true";
			const state = new Map();
			const paint = () => {
				for (const h of container.querySelectorAll("[data-sort-key]")) {
					const key = h.dataset.sortKey;
					const dir = state.get(key);
					h.setAttribute(
						"aria-sort",
						dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none",
					);
				}
			};
			paint();
			container.addEventListener("click", (e) => {
				const header = e.target.closest("[data-sort-key]");
				if (!header) return;
				const key = header.dataset.sortKey;
				const cur = state.get(key);
				const next = cur === undefined ? "asc" : cur === "asc" ? "desc" : undefined;
				if (!multi) state.clear();
				if (next === undefined) state.delete(key);
				else state.set(key, next);
				paint();
				container.dispatchEvent(
					new CustomEvent("sort", {
						detail: {
							key,
							direction: next,
							sortState: [...state.entries()].map(([k, d]) => ({
								key: k,
								direction: d,
							})),
						},
					}),
				);
			});
		},
	);
});

// ─── <v-toaster> ─────────────────────────────────────────────────────
if (!customElements.get("v-toaster")) {
	class VToasterElement extends HTMLElement {
		#toasts = new Map();
		#seq = 0;
		connectedCallback() {
			const pos = this.getAttribute("position") ?? "bottom-end";
			this.style.cssText = `position:fixed;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;padding:16px`;
			const [v, h] = pos.split("-");
			if (v === "top") this.style.top = "0";
			else this.style.bottom = "0";
			if (h === "start" || h === "left") this.style.left = "0";
			else if (h === "end" || h === "right") this.style.right = "0";
			else {
				this.style.left = "0";
				this.style.right = "0";
				this.style.alignItems = "center";
			}
		}
		show(toast) {
			const id = ++this.#seq;
			const el = document.createElement("div");
			const palette = {
				info: "#1e293b",
				success: "#15803d",
				warning: "#b45309",
				error: "#b91c1c",
			};
			const bg = palette[toast.kind ?? "info"];
			el.setAttribute(
				"role",
				toast.kind === "error" || toast.kind === "warning" ? "alert" : "status",
			);
			el.style.cssText =
				`background:${bg};color:white;padding:0.75rem 1rem;border-radius:0.5rem;max-width:24rem;box-shadow:0 4px 10px rgba(0,0,0,0.15);pointer-events:auto;cursor:pointer;font-family:system-ui,sans-serif`;
			const esc = (s) =>
				String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
					/>/g,
					"&gt;",
				);
			el.innerHTML = `${toast.title ? `<strong>${esc(toast.title)}</strong><br>` : ""}<span>${esc(toast.body)}</span>`;
			el.addEventListener("click", () => this.dismiss(id));
			this.appendChild(el);
			this.#toasts.set(id, el);
			live(`${toast.title ? toast.title + ". " : ""}${toast.body}`, {
				assertive: toast.kind === "error",
			});
			const t = toast.timeout ?? 4000;
			if (t > 0) setTimeout(() => this.dismiss(id), t);
			return id;
		}
		dismiss(id) {
			const el = this.#toasts.get(id);
			if (el) {
				el.remove();
				this.#toasts.delete(id);
			}
		}
	}
	customElements.define("v-toaster", VToasterElement);
	window.toast = (opts) => {
		let t = document.querySelector("v-toaster");
		if (!t) {
			t = document.createElement("v-toaster");
			document.body.appendChild(t);
		}
		return t.show(opts);
	};
}

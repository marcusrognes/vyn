// <v-toaster position="bottom-end"> — singleton-friendly notification
// stack. App code imports the `toast(...)` helper (or calls
// `toaster.show({ kind, body, timeout })` on the element directly)
// and the toast appears, announces via the live region, then
// dismisses itself.

import { live } from "./live.ts";

type Toast = {
	id: number;
	kind?: "info" | "success" | "warning" | "error";
	title?: string;
	body: string;
	timeout?: number;
};

class VToasterElement extends HTMLElement {
	#toasts = new Map<number, HTMLElement>();
	#seq = 0;

	connectedCallback() {
		const pos = this.getAttribute("position") ?? "bottom-end";
		this.style.position = "fixed";
		this.style.zIndex = "9999";
		this.style.display = "flex";
		this.style.flexDirection = "column";
		this.style.gap = "8px";
		this.style.pointerEvents = "none";
		this.style.padding = "16px";

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

	show(toast: Omit<Toast, "id">): number {
		const id = ++this.#seq;
		const el = document.createElement("div");
		const palette: Record<string, string> = {
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
		el.style.cssText = `
			background: ${bg};
			color: white;
			padding: 0.75rem 1rem;
			border-radius: 0.5rem;
			max-width: 24rem;
			box-shadow: 0 4px 10px rgba(0,0,0,0.15);
			pointer-events: auto;
			cursor: pointer;
			font-family: system-ui, sans-serif;
		`;
		el.innerHTML = `${toast.title ? `<strong>${escape(toast.title)}</strong><br>` : ""}<span>${escape(toast.body)}</span>`;
		el.addEventListener("click", () => this.dismiss(id));
		this.appendChild(el);
		this.#toasts.set(id, el);
		live(`${toast.title ? `${toast.title}. ` : ""}${toast.body}`, {
			assertive: toast.kind === "error",
		});
		const timeout = toast.timeout ?? 4000;
		if (timeout > 0) setTimeout(() => this.dismiss(id), timeout);
		return id;
	}

	dismiss(id: number) {
		const el = this.#toasts.get(id);
		if (!el) return;
		el.remove();
		this.#toasts.delete(id);
	}
}

function escape(s: string): string {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
		/>/g,
		"&gt;",
	);
}

// Imperative helper. Imports as `import { toast } from "@vynjs/ui/v-toaster"`.
// Lazily creates a singleton <v-toaster> on first call if one isn't mounted.
export function toast(opts: Omit<Toast, "id">): number {
	let t = document.querySelector("v-toaster") as VToasterElement | null;
	if (!t) {
		t = document.createElement("v-toaster") as VToasterElement;
		document.body.appendChild(t);
	}
	return t.show(opts);
}

if (typeof window !== "undefined" && !customElements.get("v-toaster")) {
	customElements.define("v-toaster", VToasterElement);
}

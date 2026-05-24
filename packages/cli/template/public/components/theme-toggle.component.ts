// <theme-toggle> — cycles System → Light → Dark.
//
// Tag derives from this file's basename. Reads `data-theme` from
// <html> (set by the inline boot script in index.html) and persists
// changes in localStorage.

import { component } from "@vynjs/client";

type Theme = "system" | "light" | "dark";

const order:  Theme[]                = ["system", "light", "dark"];
const labels = { system: "System", light: "Light", dark: "Dark" } as const;
const root   = document.documentElement;
const query  = matchMedia("(prefers-color-scheme: dark)");

function apply(mode: Theme): void {
	root.dataset.theme = mode;
	root.classList.toggle("dark", mode === "dark" || (mode === "system" && query.matches));
	localStorage.setItem("theme", mode);
	document.dispatchEvent(new CustomEvent("vyn:theme", { detail: { mode } }));
}

// Init from storage / OS pref on module load.
apply((localStorage.getItem("theme") as Theme | null) ?? "system");

// In "system" mode, follow OS changes.
query.addEventListener("change", () => {
	if (root.dataset.theme === "system") apply("system");
});

export default component((el) => {
	el.setAttribute("role", "button");
	el.setAttribute("tabindex", "0");
	el.setAttribute("aria-label", "Cycle theme");

	const sync = () => {
		const mode = (root.dataset.theme as Theme) ?? "system";
		el.dataset.mode = mode;
		const label = el.querySelector("[data-label]");
		if (label) label.textContent = labels[mode];
	};
	sync();

	function cycle() {
		const cur = (root.dataset.theme as Theme) ?? "system";
		apply(order[(order.indexOf(cur) + 1) % order.length]);
		sync();
	}

	el.addEventListener("click", cycle);
	el.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycle(); }
	});

	document.addEventListener("vyn:theme", sync);
	return () => document.removeEventListener("vyn:theme", sync);
});

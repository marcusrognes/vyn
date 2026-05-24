// Client-side router with file-based routing.
//
// Conventions (driven by `vyn gen`):
//
//   public/routes/index.html       → /
//   public/routes/index.ts         → /'s controller (optional)
//   public/routes/about.html       → /about
//   public/routes/posts/[id].html  → /posts/:id
//
// The HTML file is the view (markup). A sibling `.ts` with the same
// basename is the controller — its default export is called with the
// mounted DOM target and the matched URL params, and may return a
// cleanup function that runs when the route changes.
//
// `vyn gen` inlines the HTML and the controller import, so authors
// just write files; this module reads the resulting routes table.

import { type Html, render as renderHtml } from "./html.ts";

export type RouteParams = Record<string, string>;
export type RouteMount  = (el: HTMLElement, params: RouteParams) => (() => void) | void | Promise<(() => void) | void>;

export type Route = {
	path:   string;                         // "/", "/about", "/posts/:id"
	view:   Html | string | (() => Html | string | Promise<Html | string>);
	mount?: RouteMount;
};

export type RouterOpts = {
	routes:    Route[];
	mount:     HTMLElement | string;
	notFound?: Route["view"];
};

export type Router = {
	go(path: string): void;
	current(): { path: string; params: RouteParams };
	destroy(): void;
};

type Matcher = { route: Route; re: RegExp; params: string[] };

export function createRouter(opts: RouterOpts): Router {
	const root = typeof opts.mount === "string"
		? document.querySelector<HTMLElement>(opts.mount)
		: opts.mount;
	if (!root) throw new Error(`createRouter: mount target not found: ${String(opts.mount)}`);

	const matchers: Matcher[] = opts.routes.map((route) => {
		const params: string[] = [];
		const pattern = route.path
			.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
			.replace(/:([a-zA-Z_]\w*)/g, (_, name: string) => {
				params.push(name);
				return "([^/]+)";
			});
		return { route, re: new RegExp("^" + pattern + "/?$"), params };
	});

	function match(path: string): { route: Route; params: RouteParams } | null {
		for (const m of matchers) {
			const x = m.re.exec(path);
			if (!x) continue;
			const params: RouteParams = {};
			m.params.forEach((p, i) => { params[p] = decodeURIComponent(x[i + 1]); });
			return { route: m.route, params };
		}
		return null;
	}

	let token = 0;
	let cleanup: (() => void) | void;

	async function navigate(): Promise<void> {
		const my = ++token;
		const m  = match(location.pathname);

		try { cleanup?.(); } catch (e) { console.error("[router] cleanup threw:", e); }
		cleanup = undefined;

		const view = m ? m.route.view : opts.notFound;
		if (!view) return;

		const content = typeof view === "function" ? await view() : view;
		if (my !== token) return;
		if (typeof content === "string") root!.innerHTML = content;
		else                              renderHtml(root!, content);

		const mountFn = m?.route.mount;
		if (mountFn) {
			try {
				const ret = await mountFn(root!, m!.params);
				if (my !== token) { ret?.(); return; }
				cleanup = ret ?? undefined;
			} catch (e) {
				console.error("[router] mount threw:", e);
			}
		}
	}

	function go(path: string): void {
		if (path === location.pathname + location.search) return;
		history.pushState(null, "", path);
		void navigate();
	}

	function onClick(e: MouseEvent): void {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const link = (e.target as Element | null)?.closest("a");
		if (!link) return;
		const href = link.getAttribute("href");
		if (!href) return;
		if (link.target && link.target !== "_self") return;
		if (link.hasAttribute("download")) return;
		if (link.origin !== location.origin) return;
		if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
		e.preventDefault();
		go(link.pathname + link.search);
	}

	function onPop(): void { void navigate(); }

	document.addEventListener("click", onClick);
	window.addEventListener("popstate", onPop);
	void navigate();

	return {
		go,
		current: () => ({
			path:   location.pathname,
			params: match(location.pathname)?.params ?? {},
		}),
		destroy: () => {
			document.removeEventListener("click", onClick);
			window.removeEventListener("popstate", onPop);
			try { cleanup?.(); } catch { /* ignore */ }
		},
	};
}

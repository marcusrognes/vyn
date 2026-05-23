// serve() — boot Deno.serve, run staticContext once, dispatch requests
// across the RPC + WebSocket + static layers.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { handleRpc } from "./rpc.ts";
import { handleMcp } from "./mcp.ts";
import { attachWebSocket } from "./ws.ts";
import { tryStatic } from "./static.ts";
import { makeTryBundle, loadManifest } from "./bundle.ts";
import { identityTransformer, type Transformer } from "./transformer.ts";
import { EventBus, type BaseCtx, type CookieOpts } from "./ctx.ts";
import { parseCookies, serializeCookie } from "./cookies.ts";
import { installNotify, shutdownNotify, installBackgroundCtx, startCronJobs, stopCronJobs, type NotificationAdapter, type PreferencesResolver } from "@vynjs/core";

declare const Deno: {
	serve: (opts: { port: number; hostname: string; onListen?: (...a: unknown[]) => void }, handler: (req: Request) => Response | Promise<Response>) => { shutdown: () => Promise<void> };
	upgradeWebSocket: (req: Request) => { socket: WebSocket; response: Response };
	cwd: () => string;
};

export type ServeOpts<S extends object = {}, D extends object = {}> = {
	port:           number;
	host?:          string;
	publicDir?:     string;        // defaults to ./public
	transformer?:   Transformer;
	staticContext?: () => Promise<S> | S;
	createContext?: (opts: { req: Request; staticCtx: S; baseCtx: BaseCtx }) => Promise<D> | D;
	onReady?:       (opts: { url: string }) => void | Promise<void>;
	notify?: {
		adapters?:         Record<string, NotificationAdapter>;
		preferences?:      PreferencesResolver;
		coalesceWindowMs?: number;
	};
	mcp?: boolean;
	// CLI subcommands (vyn mcp --stdio, vyn worker) set this so serve() runs
	// all boot-time wiring (staticContext, installNotify, installBackgroundCtx)
	// without binding to a port.
	noListen?: boolean;
};

export async function serve<S extends object = {}, D extends object = {}>(opts: ServeOpts<S, D>) {
	const transformer = opts.transformer ?? identityTransformer;
	const publicDir   = opts.publicDir   ?? join(Deno.cwd(), "public");
	const staticCtx   = (opts.staticContext ? await opts.staticContext() : ({} as S));
	const indexHtml   = await readFile(join(publicDir, "index.html"), "utf-8").catch(() => undefined);
	const manifest    = await loadManifest(publicDir);
	const tryBundle   = makeTryBundle({ publicDir, manifest });
	const bus         = new EventBus();

	if (opts.notify) installNotify(opts.notify);

	// Background tasks (jobs, notification flush) run outside any request, so
	// the framework copies the staticCtx into a module-level slot they reach.
	installBackgroundCtx(staticCtx);
	startCronJobs();

	const buildBaseCtx = (request: Request) => {
		const sideHeaders: Record<string, string> = {};
		const sideCookies: string[] = [];
		let sideStatus: number | undefined;
		const baseCtx: BaseCtx = {
			req:    request,
			signal: request.signal,
			bus,
			setStatus(code) { sideStatus = code; },
			setHeader(name, value) { sideHeaders[name] = value; },
			setCookie(name, value, o?: CookieOpts) { sideCookies.push(serializeCookie(name, value, o)); },
		};
		return { baseCtx, sideHeaders, sideCookies, getStatus: () => sideStatus };
	};

	const dispatch = async (request: Request, baseCtx: BaseCtx): Promise<Response | null> => {
		const url2 = new URL(request.url);
		if (url2.pathname.startsWith("/rpc/")) {
			return handleRpc(request, baseCtx, async (r, b) => {
				const dyn = opts.createContext
					? await opts.createContext({ req: r, staticCtx, baseCtx: b })
					: ({} as D);
				return { ...staticCtx, ...dyn };
			}, transformer);
		}
		if (url2.pathname === "/mcp" && opts.mcp) {
			return handleMcp(request, async () => {
				const dyn = opts.createContext
					? await opts.createContext({ req: request, staticCtx, baseCtx })
					: ({} as D);
				return { ...staticCtx, ...dyn, ...baseCtx };
			});
		}
		if (url2.pathname === "/_vyn/client.js") return serveClientBundle();
		if (url2.pathname === "/_vyn/ui.js")     return serveUiBundle();

		const bundled = await tryBundle(url2.pathname);
		if (bundled) return bundled;
		return tryStatic(request, { root: publicDir, indexHtml });
	};

	if (opts.noListen) {
		console.log(`[vyn] boot-only mode (noListen) — actions registered, no HTTP bind`);
		return { close: async () => { shutdownNotify(); }, bus, staticCtx };
	}

	const denoServer = Deno.serve({ port: opts.port, hostname: opts.host ?? "0.0.0.0", onListen: () => {} }, async (request: Request) => {
		const url2 = new URL(request.url);

		// Native WS upgrade.
		if (url2.pathname === "/ws" && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
			try {
				const { socket, response } = Deno.upgradeWebSocket(request);
				socket.addEventListener("open", () => {
					const { baseCtx } = buildBaseCtx(request);
					attachWebSocket(socket, request, baseCtx, {
						transformer,
						makeCtx: async (r, b) => {
							const dyn = opts.createContext
								? await opts.createContext({ req: r, staticCtx, baseCtx: b })
								: ({} as D);
							return { ...staticCtx, ...dyn };
						},
					});
				});
				return response;
			} catch (e) {
				console.error("[vyn] upgradeWebSocket failed:", e);
				return new Response("ws upgrade failed", { status: 500 });
			}
		}

		const { baseCtx, sideHeaders, sideCookies, getStatus } = buildBaseCtx(request);
		try {
			let response = await dispatch(request, baseCtx);
			if (!response) response = new Response("not found", { status: 404 });
			return applySideChannel(response, { sideHeaders, sideCookies, sideStatus: getStatus() });
		} catch (e) {
			console.error("[vyn] handler error:", e);
			return new Response((e as Error).message, { status: 500, headers: { "content-type": "text/plain" } });
		}
	});

	const { registry } = await import("@vynjs/core");
	const counts = registry.list().reduce((acc, a) => { acc[a.kind] = (acc[a.kind] ?? 0) + 1; return acc; }, {} as Record<string, number>);
	const url = `http://${opts.host ?? "localhost"}:${opts.port}`;
	console.log(`[vyn] listening on ${url} — ${registry.list().length} actions registered (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")})`);
	await opts.onReady?.({ url });

	return {
		close: async () => { stopCronJobs(); shutdownNotify(); await denoServer.shutdown(); },
		bus,
		staticCtx,
	};
}

function applySideChannel(res: Response, side: { sideHeaders: Record<string, string>; sideCookies: string[]; sideStatus?: number }): Response {
	if (!side.sideStatus && Object.keys(side.sideHeaders).length === 0 && side.sideCookies.length === 0) return res;
	const headers = new Headers(res.headers);
	for (const [k, v] of Object.entries(side.sideHeaders)) headers.set(k, v);
	for (const c of side.sideCookies)                      headers.append("set-cookie", c);
	return new Response(res.body, { status: side.sideStatus ?? res.status, headers });
}

// Resolves once per process so the file is read at first hit, then cached.
let clientBundle: string | undefined;
let uiBundle:     string | undefined;
async function serveClientBundle(): Promise<Response> {
	if (!clientBundle) {
		const url  = await import.meta.resolve("@vynjs/client/browser.js");
		clientBundle = await readFile(new URL(url), "utf-8");
	}
	return new Response(clientBundle, {
		status:  200,
		headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" },
	});
}
async function serveUiBundle(): Promise<Response> {
	if (!uiBundle) {
		try {
			const url = await import.meta.resolve("@vynjs/ui/browser.js");
			uiBundle = await readFile(new URL(url), "utf-8");
		} catch {
			return new Response("@vynjs/ui is not installed", { status: 404 });
		}
	}
	return new Response(uiBundle, {
		status:  200,
		headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" },
	});
}

export { parseCookies, serializeCookie };

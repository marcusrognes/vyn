// serve() — boot the HTTP server, run staticContext once, and
// dispatch requests across the RPC + WebSocket + static layers.
//
// Uses Node's built-in `node:http` so apps run without bundlers /
// transpilers. WebSocket support uses the `ws` package because
// `node:http` doesn't ship it natively.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
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
import { installNotify, shutdownNotify, installBackgroundCtx, startCronJobs, stopCronJobs, type NotificationAdapter, type PreferencesResolver } from "@vyn/core";

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
	// CLI subcommands (vyn mcp --stdio, vyn worker) set this so serve()
	// runs all the boot-time wiring (staticContext, installNotify,
	// installBackgroundCtx) without binding to a port.
	noListen?: boolean;
};

export async function serve<S extends object = {}, D extends object = {}>(opts: ServeOpts<S, D>) {
	const transformer = opts.transformer ?? identityTransformer;
	const publicDir   = opts.publicDir   ?? join(process.cwd(), "public");
	const staticCtx   = (opts.staticContext ? await opts.staticContext() : ({} as S));
	const indexHtml   = await readFile(join(publicDir, "index.html"), "utf-8").catch(() => undefined);
	const manifest    = await loadManifest(publicDir);
	const tryBundle   = makeTryBundle({ publicDir, manifest });
	const bus         = new EventBus();

	if (opts.notify) installNotify(opts.notify);

	// Background tasks (jobs, notification flush) run outside any request,
	// so the framework copies the staticCtx into a module-level slot they
	// can reach.
	installBackgroundCtx(staticCtx);
	startCronJobs();

	const server = createServer(async (req, res) => {
		const url     = `http://${req.headers.host}${req.url}`;
		const request = nodeReqToFetch(req, url);

		// Mutable response side-channel — actions write here via ctx.setHeader/setCookie/setStatus.
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

		try {
			let response: Response | null = null;
			const url2 = new URL(url);

			if (url2.pathname.startsWith("/rpc/")) {
				response = await handleRpc(request, baseCtx, async (r, b) => {
					const dyn = opts.createContext
						? await opts.createContext({ req: r, staticCtx, baseCtx: b })
						: ({} as D);
					return { ...staticCtx, ...dyn };
				}, transformer);
			} else if (url2.pathname === "/mcp" && opts.mcp) {
				response = await handleMcp(request, async () => {
					const dyn = opts.createContext
						? await opts.createContext({ req: request, staticCtx, baseCtx })
						: ({} as D);
					return { ...staticCtx, ...dyn, ...baseCtx };
				});
			} else if (url2.pathname === "/_vyn/client.js") {
				response = await serveClientBundle();
			} else if (url2.pathname === "/_vyn/ui.js") {
				response = await serveUiBundle();
			} else {
				response = await tryBundle(url2.pathname);
				if (!response) response = await tryStatic(request, { root: publicDir, indexHtml });
			}

			if (!response) response = new Response("not found", { status: 404 });
			await sendFetchResponse(res, response, { sideHeaders, sideCookies, sideStatus });
		} catch (e) {
			console.error("[vyn] handler error:", e);
			if (!res.headersSent) {
				res.writeHead(500, { "content-type": "text/plain" });
				res.end((e as Error).message);
			} else {
				res.end();
			}
		}
	});

	// WebSocket upgrade for subscriptions.
	server.on("upgrade", async (req, socket, head) => {
		if (!req.url?.startsWith("/ws")) {
			socket.destroy();
			return;
		}
		try {
			const { WebSocketServer } = await import("ws");
			const wss = (server as any).__wss ?? ((server as any).__wss = new WebSocketServer({ noServer: true }));
			wss.handleUpgrade(req, socket, head, async (ws: WebSocket) => {
				const url     = `http://${req.headers.host}${req.url}`;
				const request = nodeReqToFetch(req, url);
				const baseCtx: BaseCtx = {
					req:    request,
					signal: request.signal,
					bus,
					setStatus()   {},
					setHeader()   {},
					setCookie()   {},
				};
				attachWebSocket(ws, request, baseCtx, {
					transformer,
					makeCtx: async (r, b) => {
						const dyn = opts.createContext
							? await opts.createContext({ req: r, staticCtx, baseCtx: b })
							: ({} as D);
						return { ...staticCtx, ...dyn };
					},
				});
			});
		} catch (e) {
			console.error("[vyn] websocket upgrade failed (is the `ws` package installed?):", e);
			socket.destroy();
		}
	});

	if (opts.noListen) {
		console.log(`[vyn] boot-only mode (noListen) — actions registered, no HTTP bind`);
		return {
			close: async () => { shutdownNotify(); },
			bus,
			staticCtx,
		};
	}

	await new Promise<void>((resolve) => {
		server.listen(opts.port, opts.host ?? "0.0.0.0", () => resolve());
	});

	const { registry } = await import("@vyn/core");
	const counts = registry.list().reduce((acc, a) => { acc[a.kind] = (acc[a.kind] ?? 0) + 1; return acc; }, {} as Record<string, number>);
	const url = `http://${opts.host ?? "localhost"}:${opts.port}`;
	console.log(`[vyn] listening on ${url} — ${registry.list().length} actions registered (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")})`);
	await opts.onReady?.({ url });

	return {
		close: () => new Promise<void>((r) => { stopCronJobs(); shutdownNotify(); server.close(() => r()); }),
		bus,
		staticCtx,
	};
}

function nodeReqToFetch(req: IncomingMessage, url: string): Request {
	const headers = new Headers();
	for (const [k, v] of Object.entries(req.headers)) {
		if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
		else if (v !== undefined) headers.set(k, v as string);
	}
	const init: RequestInit = { method: req.method, headers };
	if (req.method && req.method !== "GET" && req.method !== "HEAD") {
		init.body = nodeReadableToWebReadable(req) as any;
		(init as any).duplex = "half";
	}
	return new Request(url, init);
}

function nodeReadableToWebReadable(req: IncomingMessage): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			req.on("data",  (chunk) => controller.enqueue(new Uint8Array(chunk)));
			req.on("end",   () => controller.close());
			req.on("error", (e) => controller.error(e));
		},
	});
}

async function sendFetchResponse(res: ServerResponse, fetchRes: Response, side: { sideHeaders: Record<string, string>; sideCookies: string[]; sideStatus?: number }) {
	const status = side.sideStatus ?? fetchRes.status;
	const headers: Record<string, string | string[]> = {};
	fetchRes.headers.forEach((v, k) => { headers[k] = v; });
	for (const [k, v] of Object.entries(side.sideHeaders)) headers[k] = v;
	if (side.sideCookies.length) headers["set-cookie"] = side.sideCookies;

	res.writeHead(status, headers);
	if (fetchRes.body) {
		const reader = fetchRes.body.getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			res.write(Buffer.from(value));
		}
	}
	res.end();
}

// Resolves at boot time so the file is read once.
let clientBundle: string | undefined;
let uiBundle:     string | undefined;
async function serveClientBundle(): Promise<Response> {
	if (!clientBundle) {
		const url = await import.meta.resolve?.("@vyn/client/browser.js");
		const path = url ? new URL(url).pathname : require.resolve("@vyn/client/browser.js");
		clientBundle = await readFile(path, "utf-8");
	}
	return new Response(clientBundle, {
		status:  200,
		headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" },
	});
}
async function serveUiBundle(): Promise<Response> {
	if (!uiBundle) {
		try {
			const url = await import.meta.resolve?.("@vyn/ui/browser.js");
			const path = url ? new URL(url).pathname : require.resolve("@vyn/ui/browser.js");
			uiBundle = await readFile(path, "utf-8");
		} catch {
			return new Response("@vyn/ui is not installed", { status: 404 });
		}
	}
	return new Response(uiBundle, {
		status:  200,
		headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" },
	});
}

export { parseCookies, serializeCookie };

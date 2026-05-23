// Static file serving for the public/ directory and the route SPA shell.
// In dev, files are read fresh on each request. In prod, build emits
// a manifest and pre-hashed asset names; static here just serves them.

import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js":   "text/javascript; charset=utf-8",
	".mjs":  "text/javascript; charset=utf-8",
	".css":  "text/css; charset=utf-8",
	".json": "application/json",
	".svg":  "image/svg+xml",
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".gif":  "image/gif",
	".webp": "image/webp",
	".ico":  "image/x-icon",
	".woff": "font/woff",
	".woff2":"font/woff2",
	".txt":  "text/plain; charset=utf-8",
};

export type StaticOpts = {
	root:     string;       // path to public/
	indexHtml?: string;     // contents of the SPA shell — served for any non-asset request
};

export async function tryStatic(req: Request, opts: StaticOpts): Promise<Response | null> {
	const url = new URL(req.url);
	if (req.method !== "GET" && req.method !== "HEAD") return null;
	if (url.pathname.startsWith("/rpc/") || url.pathname.startsWith("/ws") || url.pathname.startsWith("/mcp")) return null;

	const safe = url.pathname.replace(/\.\.+/g, "");
	const filePath = join(opts.root, safe === "/" ? "" : safe);

	try {
		const s = await stat(filePath);
		if (s.isFile()) {
			const body = await readFile(filePath);
			return new Response(new Uint8Array(body), {
				status:  200,
				headers: {
					"content-type": MIME[extname(filePath)] ?? "application/octet-stream",
				},
			});
		}
	} catch { /* fall through to SPA shell */ }

	// SPA fallback for anything that's not a known asset
	if (opts.indexHtml && extname(url.pathname) === "") {
		return new Response(opts.indexHtml, {
			status:  200,
			headers: { "content-type": MIME[".html"] },
		});
	}
	return null;
}

// On-demand .ts → .js bundler for files under publicDir.
//
// Dev (no manifest): GET /foo.js → look for sibling foo.ts → bundle and
// return as JS. Cache the result keyed by the entry file's mtime so
// editing it invalidates correctly.
//
// Prod (manifest passed): look up the pathname in the manifest and serve
// the hashed dist/ file with an immutable cache-control header.
//
// Bundling is delegated to `deno bundle` (subprocess against the running
// Deno binary). Deno's bundle subcommand wraps esbuild internally and
// resolves the app's jsr:/npm: specifiers without a third-party plugin,
// so no npm:esbuild import is needed in vyn source.

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export type Manifest = Record<string, string>;  // srcUrl (e.g. "/routes/index.js") → hashed dist path ("/dist/routes/index.a1b2c3.js")

export type BundleOpts = {
	publicDir: string;
	manifest?: Manifest | null;  // present in prod, null/undefined in dev
};

type CacheEntry = { js: string; entryMtime: number };

export function makeTryBundle(opts: BundleOpts): (pathname: string) => Promise<Response | null> {
	const cache = new Map<string, CacheEntry>();

	return async function tryBundle(pathname: string): Promise<Response | null> {
		if (!pathname.endsWith(".js")) return null;
		const safe = pathname.replace(/\.\.+/g, "");

		// Prod path — manifest lookup, immutable cache.
		if (opts.manifest) {
			const hashed = safe.startsWith("/dist/") ? safe : opts.manifest[safe];
			if (!hashed) return null;
			try {
				const body = await readFile(join(opts.publicDir, hashed));
				return new Response(new Uint8Array(body), {
					status:  200,
					headers: {
						"content-type":  "text/javascript; charset=utf-8",
						"cache-control": "public, max-age=31536000, immutable",
					},
				});
			} catch {
				return null;
			}
		}

		// Dev path — find sibling .ts, bundle on demand.
		const tsPath = join(opts.publicDir, safe.slice(0, -3) + ".ts");
		let entryMtime: number;
		try {
			const s = await stat(tsPath);
			if (!s.isFile()) return null;
			entryMtime = s.mtimeMs;
		} catch {
			return null;
		}

		const cached = cache.get(tsPath);
		if (cached && cached.entryMtime === entryMtime) {
			return jsResponse(cached.js);
		}

		try {
			const js = await bundleEntry(tsPath);
			cache.set(tsPath, { js, entryMtime });
			return jsResponse(js);
		} catch (e) {
			const msg = (e as Error).message;
			console.error(`[vyn] bundle ${tsPath} failed:\n${msg}`);
			return new Response(`/* vyn bundle error\n${msg.replace(/\*\//g, "*\\/")}\n*/`, {
				status:  500,
				headers: { "content-type": "text/javascript; charset=utf-8" },
			});
		}
	};
}

function jsResponse(js: string): Response {
	return new Response(js, {
		status:  200,
		headers: {
			"content-type":  "text/javascript; charset=utf-8",
			"cache-control": "no-cache",
		},
	});
}

async function bundleEntry(entryPath: string): Promise<string> {
	const cmd = new Deno.Command(Deno.execPath(), {
		args: [
			"bundle",
			"--platform=browser",
			"--minify",
			entryPath,
		],
		stdout: "piped",
		stderr: "piped",
	});
	const { code, stdout, stderr } = await cmd.output();
	if (code !== 0) {
		throw new Error(new TextDecoder().decode(stderr));
	}
	return new TextDecoder().decode(stdout);
}

// Read public/dist/manifest.json if present. Returns null in dev (no build run).
export async function loadManifest(publicDir: string): Promise<Manifest | null> {
	try {
		const raw = await readFile(join(publicDir, "dist", "manifest.json"), "utf-8");
		return JSON.parse(raw) as Manifest;
	} catch {
		return null;
	}
}

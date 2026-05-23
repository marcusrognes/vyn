// On-demand .ts → .js bundler for files under publicDir.
//
// Dev (no manifest): GET /foo.js → look for sibling foo.ts → bundle and
// return as JS. Cache the result keyed by every input file's mtime so
// editing a transitive import invalidates correctly.
//
// Prod (manifest passed): look up the pathname in the manifest and serve
// the hashed dist/ file with an immutable cache-control header.
//
// Uses `npm:esbuild` + `jsr:@luca/esbuild-deno-loader` so bare specifiers
// declared in the consuming deno.json import map (e.g. "@vyn/client") resolve
// in browser bundles. esbuild's metafile drives the transitive-input cache.

import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.11.0";
import * as esbuild from "npm:esbuild@^0.24.0";

export type Manifest = Record<string, string>;  // srcUrl (e.g. "/routes/index.js") → hashed dist path ("/dist/routes/index.a1b2c3.js")

export type BundleOpts = {
	publicDir: string;
	manifest?: Manifest | null;  // present in prod, null/undefined in dev
};

type CacheEntry = { js: string; inputs: Map<string, number> };

export function makeTryBundle(opts: BundleOpts) {
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
				return new Response(body, {
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
		try {
			const s = await stat(tsPath);
			if (!s.isFile()) return null;
		} catch {
			return null;
		}

		const cached = cache.get(tsPath);
		if (cached && await inputsUnchanged(cached.inputs)) {
			return jsResponse(cached.js);
		}

		try {
			const built = await bundleEntry(tsPath);
			cache.set(tsPath, built);
			return jsResponse(built.js);
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

async function inputsUnchanged(inputs: Map<string, number>): Promise<boolean> {
	for (const [path, mtime] of inputs) {
		try {
			const s = await stat(path);
			if (s.mtimeMs !== mtime) return false;
		} catch {
			return false;
		}
	}
	return true;
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

async function bundleEntry(entryPath: string): Promise<CacheEntry> {
	const result = await esbuild.build({
		entryPoints: [entryPath],
		bundle:      true,
		format:      "esm",
		platform:    "browser",
		target:      "es2022",
		write:       false,
		metafile:    true,
		sourcemap:   "inline",
		logLevel:    "silent",
		plugins:     denoPlugins({ loader: "portable" }),
	});
	const js = result.outputFiles![0].text;
	const inputs = new Map<string, number>();
	for (const path of Object.keys(result.metafile!.inputs)) {
		try {
			const s = await stat(path);
			inputs.set(path, s.mtimeMs);
		} catch { /* generated/virtual input, skip */ }
	}
	return { js, inputs };
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

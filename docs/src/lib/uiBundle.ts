// Server-side bundler for @vynjs/ui behaviors.
//
// LiveExample uses this to embed real @vynjs/ui code inside a sandboxed
// iframe: the TypeScript source is bundled to a minified IIFE that runs
// the moment the iframe parses it. Results are cached for the life of
// the build / dev server.

import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, statSync } from "node:fs";

// `import.meta.url` points at the source file in dev but inside
// `dist/.prerender/chunks/` after `astro build`, which breaks any
// fixed-offset relative path. Walk up from `here` AND from `cwd()`
// until we land on a directory that actually contains
// packages/ui/src.
function findUiSrc(): string {
	const seeds = [dirname(fileURLToPath(import.meta.url)), process.cwd()];
	for (const seed of seeds) {
		let dir = seed;
		for (let i = 0; i < 8; i++) {
			const candidate = join(dir, "packages/ui/src");
			if (existsSync(candidate)) return candidate;
			const parent = dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
	}
	throw new Error("could not locate packages/ui/src relative to docs/ or import.meta.url");
}

const UI_SRC = findUiSrc();

const cache = new Map<string, { mtime: number; text: string }>();

export async function bundleUi(name: string): Promise<string> {
	const entry = join(UI_SRC, `${name}.ts`);
	if (!existsSync(entry)) {
		throw new Error(`@vynjs/ui module not found: ${name} (expected ${entry})`);
	}
	const mtime = statSync(entry).mtimeMs;
	const hit = cache.get(name);
	if (hit && hit.mtime === mtime) return hit.text;

	const safe = name.replace(/[^a-zA-Z0-9]/g, "_");
	const result = await esbuild.build({
		entryPoints: [entry],
		bundle: true,
		format: "iife",
		globalName: `__vynUi_${safe}`,
		write: false,
		minify: true,
		target: ["es2022"],
		platform: "browser",
		logLevel: "silent",
		footer: { js: `globalThis.__vynUi=globalThis.__vynUi||{};Object.assign(globalThis.__vynUi,__vynUi_${safe}||{});` },
	});

	const text = result.outputFiles[0]?.text ?? "";
	cache.set(name, { mtime, text });
	return text;
}

export async function bundleManyUi(names: readonly string[]): Promise<string[]> {
	return Promise.all(names.map(bundleUi));
}

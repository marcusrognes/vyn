import { afterAll, beforeAll, describe, expect, it } from "vyn:test";
import { mkdtemp, mkdir, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeTryBundle, loadManifest } from "../src/bundle.ts";

describe("bundle (dev)", () => {
	let root: string;
	let publicDir: string;

	beforeAll(async () => {
		root      = await mkdtemp(join(tmpdir(), "vyn-bundle-"));
		publicDir = join(root, "public");
		await mkdir(join(publicDir, "routes"), { recursive: true });
		await writeFile(join(publicDir, "routes", "index.ts"), `
			import { greet } from "./util.ts";
			console.log(greet("world"));
		`);
		await writeFile(join(publicDir, "routes", "util.ts"), `
			export const greet = (name: string): string => \`hello \${name}\`;
		`);
	});

	afterAll(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("bundles sibling .ts as JS for a .js request", async () => {
		const tryBundle = makeTryBundle({ publicDir });
		const res = await tryBundle("/routes/index.js");
		expect(res).not.toBeNull();
		expect(res!.status).toBe(200);
		expect(res!.headers.get("content-type")).toMatch(/javascript/);
		const text = await res!.text();
		expect(text).toContain("hello");
	});

	it("returns null when no sibling .ts exists (falls through to static)", async () => {
		const tryBundle = makeTryBundle({ publicDir });
		const res = await tryBundle("/routes/missing.js");
		expect(res).toBeNull();
	});

	it("returns null for non-.js requests", async () => {
		const tryBundle = makeTryBundle({ publicDir });
		const res = await tryBundle("/routes/index.html");
		expect(res).toBeNull();
	});

	it("caches by transitive-input mtimes (same content on repeat call)", async () => {
		const tryBundle = makeTryBundle({ publicDir });
		const a = await (await tryBundle("/routes/index.js"))!.text();
		const b = await (await tryBundle("/routes/index.js"))!.text();
		expect(a).toBe(b);
	});

	it("invalidates cache when a transitive import changes", async () => {
		const tryBundle = makeTryBundle({ publicDir });
		const first = await (await tryBundle("/routes/index.js"))!.text();

		const utilPath = join(publicDir, "routes", "util.ts");
		// Bump mtime by writing a different export.
		await writeFile(utilPath, `
			export const greet = (name: string): string => \`hi \${name}\`;
		`);
		// Ensure the mtime tick is visible (fs resolution can be coarse).
		const future = new Date(Date.now() + 2000);
		const { utimes } = await import("node:fs/promises");
		await utimes(utilPath, future, future);

		const second = await (await tryBundle("/routes/index.js"))!.text();
		expect(first).not.toBe(second);
		expect(second).toContain("hi");
	});

	it("returns 500 with bundle-error JS when the entry is invalid", async () => {
		const broken = join(publicDir, "routes", "broken.ts");
		await writeFile(broken, `this is not valid typescript {{{ <<< )))`);
		const tryBundle = makeTryBundle({ publicDir });
		const res = await tryBundle("/routes/broken.js");
		expect(res).not.toBeNull();
		expect(res!.status).toBe(500);
		const body = await res!.text();
		expect(body).toContain("vyn bundle error");
	});
});

describe("bundle (prod manifest)", () => {
	let root: string;
	let publicDir: string;

	beforeAll(async () => {
		root      = await mkdtemp(join(tmpdir(), "vyn-bundle-prod-"));
		publicDir = join(root, "public");
		await mkdir(join(publicDir, "dist", "routes"), { recursive: true });
		await writeFile(join(publicDir, "dist", "routes", "index.abc123.js"), "console.log('built');");
		await writeFile(
			join(publicDir, "dist", "manifest.json"),
			JSON.stringify({ "/routes/index.js": "/dist/routes/index.abc123.js" }),
		);
	});

	afterAll(async () => {
		await rm(root, { recursive: true, force: true });
	});

	it("loadManifest reads dist/manifest.json", async () => {
		const m = await loadManifest(publicDir);
		expect(m).toEqual({ "/routes/index.js": "/dist/routes/index.abc123.js" });
	});

	it("loadManifest returns null when no build has run", async () => {
		const empty = await mkdtemp(join(tmpdir(), "vyn-bundle-empty-"));
		const m = await loadManifest(join(empty, "public"));
		expect(m).toBeNull();
		await rm(empty, { recursive: true, force: true });
	});

	it("serves manifest-mapped requests as the hashed dist file", async () => {
		const manifest = await loadManifest(publicDir);
		const tryBundle = makeTryBundle({ publicDir, manifest });
		const res = await tryBundle("/routes/index.js");
		expect(res).not.toBeNull();
		expect(res!.status).toBe(200);
		expect(res!.headers.get("cache-control")).toMatch(/immutable/);
		const text = await res!.text();
		expect(text).toContain("built");
	});

	it("serves direct /dist/ requests too", async () => {
		const manifest = await loadManifest(publicDir);
		const tryBundle = makeTryBundle({ publicDir, manifest });
		const res = await tryBundle("/dist/routes/index.abc123.js");
		expect(res).not.toBeNull();
		expect(res!.status).toBe(200);
		expect(res!.headers.get("cache-control")).toMatch(/immutable/);
	});

	it("returns null for paths not in the manifest", async () => {
		const manifest = await loadManifest(publicDir);
		const tryBundle = makeTryBundle({ publicDir, manifest });
		const res = await tryBundle("/routes/unknown.js");
		expect(res).toBeNull();
	});
});

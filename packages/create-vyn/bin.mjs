#!/usr/bin/env node
// create-vyn — scaffolds a Vyn app by delegating to @vynjs/cli's init.
//
// Usage:
//   deno create npm:vyn -- my-app
//   npm create vyn@latest my-app
//   npx create-vyn@latest my-app

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const target = process.argv[2];
if (!target) {
	console.error("Usage: create-vyn <directory>");
	process.exit(1);
}

const dir = resolve(target);
if (existsSync(dir)) {
	console.error(`Error: ${dir} already exists.`);
	process.exit(1);
}
mkdirSync(dir, { recursive: true });

const result = spawnSync(
	"deno",
	["run", "-A", "--unstable-node-globals", "--unstable-bare-node-builtins", "jsr:@vynjs/cli@^0.2", "init"],
	{ cwd: dir, stdio: "inherit" },
);

if (result.error?.code === "ENOENT") {
	console.error("\nError: deno is not installed. Get it at https://deno.com/install");
	process.exit(1);
}

if (result.status === 0) {
	console.log(`\nDone. Next:`);
	console.log(`  cd ${target}`);
	console.log(`  deno task dev`);
}

process.exit(result.status ?? 1);

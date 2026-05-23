#!/usr/bin/env node
// create-vyn — scaffolds a Vyn app.
//
// Usage:
//   deno create vyn@latest my-app
//   npm create vyn@latest my-app
//   npx create-vyn@latest my-app

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
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

const name = basename(dir);

const files = {
	"deno.json": JSON.stringify({
		tasks: {
			dev:   "deno run -A --watch --unstable-node-globals --unstable-bare-node-builtins server.ts",
			start: "deno run -A --unstable-node-globals --unstable-bare-node-builtins server.ts",
			check: "deno check server.ts",
		},
		imports: {
			"@vynjs/core":   "jsr:@vynjs/core@^0.1",
			"@vynjs/client": "jsr:@vynjs/client@^0.1",
			"@vynjs/ui":     "jsr:@vynjs/ui@^0.1",
		},
		nodeModulesDir: "auto",
		compilerOptions: { lib: ["deno.window", "dom", "dom.iterable", "esnext"], strict: true },
		unstable: ["node-globals", "bare-node-builtins"],
	}, null, 2) + "\n",

	"server.ts": `import { createQuery, v } from "@vynjs/core";

export const greet = createQuery({
	description: "Say hello to someone.",
	input:  v.object({ name: v.string().default("world") }),
	output: v.string(),
	run: async (opts) => \`Hello, \${opts.input.name}!\`,
});

console.log("Hello from Vyn. Hook up @vynjs/server next.");
`,

	"public/index.html": `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>${name}</title>
	<link rel="stylesheet" href="/style.css">
</head>
<body>
	<main>
		<h1>Hello from Vyn.</h1>
		<p>Edit <code>server.ts</code> to get started.</p>
	</main>
	<script type="module" src="/main.js"></script>
</body>
</html>
`,

	"public/main.js":  `console.log("hello vyn");\n`,
	"public/style.css": `body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 40rem; margin: 0 auto; }
code { background: #f1f5f9; padding: 0.1em 0.3em; border-radius: 0.25em; }
`,

	".gitignore": `node_modules
.env
.env.*
!.env.example
*.db
*.db-journal
dist
`,

	"README.md": `# ${name}

A Vyn app.

\`\`\`sh
deno task dev
\`\`\`

See https://github.com/marcusrognes/vyn for docs.
`,
};

for (const [path, content] of Object.entries(files)) {
	const full = join(dir, path);
	mkdirSync(dirname(full), { recursive: true });
	writeFileSync(full, content);
	console.log(`  create ${path}`);
}

console.log(`\nDone. Next:`);
console.log(`  cd ${target}`);
console.log(`  deno task dev`);

// Optional: warn early if deno isn't installed.
const dn = spawnSync("deno", ["--version"], { stdio: "ignore" });
if (dn.error?.code === "ENOENT") {
	console.log(`\nNote: Deno isn't installed. Get it at https://deno.com/install`);
}

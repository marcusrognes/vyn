// @vynjs/create — scaffolds a Vyn app.
//
// Usage:
//   deno create jsr:@vynjs/create -- my-app
//   deno run -A jsr:@vynjs/create my-app
//
// Delegates to `@vynjs/cli init <dir>` so the scaffold template lives
// in one place.
//
// Local-development override:
//   VYN_CLI=/path/to/packages/cli/src/index.ts deno run -A mod.ts test-app
// Set VYN_CLI to a local file path (or any deno-runnable spec) to test
// the wrapper against a local cli without republishing.

const target = Deno.args[0];
if (!target) {
	console.error("Usage: deno create jsr:@vynjs/create <directory>");
	Deno.exit(1);
}

const cliSpec = Deno.env.get("VYN_CLI") ?? "jsr:@vynjs/cli@^0.2";

const cmd = new Deno.Command(Deno.execPath(), {
	args: ["run", "-A", cliSpec, "init", target],
	stdout: "inherit",
	stderr: "inherit",
	stdin:  "inherit",
});
const { code } = await cmd.output();
Deno.exit(code);

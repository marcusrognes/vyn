// @vynjs/create — scaffolds a Vyn app.
//
// Usage:
//   deno create jsr:@vynjs/create my-app
//   deno run -A jsr:@vynjs/create my-app
//
// Delegates to `@vynjs/cli init <dir>` so the scaffold template lives
// in one place.

const target = Deno.args[0];
if (!target) {
	console.error("Usage: deno create jsr:@vynjs/create <directory>");
	Deno.exit(1);
}

const cmd = new Deno.Command(Deno.execPath(), {
	args: ["run", "-A", "jsr:@vynjs/cli@^0.2", "init", target],
	stdout: "inherit",
	stderr: "inherit",
	stdin:  "inherit",
});
const { code } = await cmd.output();
Deno.exit(code);

import { defineWorkspace } from "vitest/config";

// Vitest workspaces run each package's tests in isolation so per-package
// config (jsdom vs node environment, etc.) is honored. Adding a new
// package means pointing at its vitest.config.ts here.
export default defineWorkspace([
	"packages/core",
	"packages/server",
	"packages/client",
	"packages/auth",
	"packages/cli",
	"packages/ui",
	"packages/db-sqlite",
	"packages/db-mongo",
]);

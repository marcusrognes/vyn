import { defineConfig } from "vitest/config";
export default defineConfig({
	test: {
		name:        "db-sqlite",
		environment: "node",
		include:     ["test/**/*.test.ts"],
		server:      { deps: { external: ["node:sqlite", /^node:/] } },
	},
	ssr: { noExternal: [] },
});

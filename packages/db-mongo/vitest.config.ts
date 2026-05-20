import { defineConfig } from "vitest/config";
export default defineConfig({
	test: { name: "db-mongo", environment: "node", include: ["test/**/*.test.ts"] },
});

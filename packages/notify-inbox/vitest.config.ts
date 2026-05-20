import { defineConfig } from "vitest/config";
export default defineConfig({
	test: { name: "notify-inbox", environment: "node", include: ["test/**/*.test.ts"] },
});

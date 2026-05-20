import { defineConfig } from "vitest/config";
export default defineConfig({
	test: { name: "client", environment: "happy-dom", include: ["test/**/*.test.ts"] },
});

import { defineConfig } from "vitest/config";
// UI behavior unit tests run in happy-dom; full keyboard / focus /
// ARIA integration tests live in test/playwright/ and run via
// `npm run test:ui` at the root.
export default defineConfig({
	test: { name: "ui", environment: "happy-dom", include: ["test/unit/**/*.test.ts"] },
});

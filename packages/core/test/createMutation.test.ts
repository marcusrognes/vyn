import { describe, expect, it } from "vitest";
import { createMutation } from "../src/index.ts";

// Contracts from /guide/actions/#the-three-primitives
// and /guide/realtime/ (the .emit reach-out is on subscriptions, not mutations;
// mutations import + call subscription.emit themselves)
describe("createMutation", () => {
	it("returns an action record with kind 'mutation'", () => {
		const m = createMutation({ run: async () => undefined });
		expect(m.kind).toBe("mutation");
	});

	it("treats input as optional, defaulting to v.object({})", () => {
		const m = createMutation({ run: async () => undefined });
		expect(m.input).toBeDefined();
	});

	it("treats output as optional everywhere", () => {
		const m = createMutation({ run: async () => undefined });
		expect(m.output).toBeUndefined();
	});

	it("does NOT accept invalidates field — server has no .invalidate()", () => {
		expect(() =>
			createMutation({
				// @ts-expect-error: invalidates is intentionally not part of the type
				invalidates: ["something"],
				run: async () => undefined,
			})
		).toThrow(/invalidates/);
	});

	it("exposes only .run — no .emit, no .invalidate", () => {
		const m = createMutation({ run: async () => undefined });
		expect(typeof m.run).toBe("function");
		expect("emit" in m).toBe(false);
		expect("invalidate" in m).toBe(false);
	});

	it("calls run with opts containing input and ctx", async () => {
		const m = createMutation({
			run: async (opts) => {
				expect(opts).toHaveProperty("input");
				expect(opts).toHaveProperty("ctx");
				return "ok";
			},
		});
		await m.run({ input: {}, ctx: {} });
	});

	it("validates input against the input schema before run", async () => {
		const { v } = await import("../src/index.ts");
		const m = createMutation({
			input: v.object({ id: v.string() }),
			run:   async () => undefined,
		});
		await expect(m.run({ input: { id: 42 }, ctx: {} })).rejects.toThrow();
	});

	it("returns void when output is omitted", async () => {
		const m = createMutation({ run: async () => undefined });
		const result = await m.run({ input: {}, ctx: {} });
		expect(result).toBeUndefined();
	});

	it("registers itself in the global registry on declaration", async () => {
		const { registry } = await import("../src/index.ts");
		const m = createMutation({ name: "test.notes.create", run: async () => "x" });
		expect(registry.get(m.name)).toBe(m);
	});

	it("requires description when tool is set", () => {
		expect(() =>
			createMutation({
				tool: {},
				run:  async () => undefined,
			})
		).toThrow(/description/);
	});

	it("requires output when tool is set", () => {
		expect(() =>
			createMutation({
				description: "Create note",
				tool:        {},
				run:         async () => undefined,
			})
		).toThrow(/output/);
	});
});

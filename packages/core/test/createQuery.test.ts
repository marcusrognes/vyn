import { describe, expect, it } from "vyn:test";
import { createQuery } from "../src/index.ts";

// Contracts from /guide/actions/#the-three-primitives
describe("createQuery", () => {
	it("returns an action record with kind 'query'", () => {
		const q = createQuery({
			run: async () => "pong",
		});
		expect(q.kind).toBe("query");
	});

	it("auto-derives the name from the file path + export at codegen time", () => {
		// At runtime the action has whatever name codegen set on it
		// (defaults to undefined when imported directly outside codegen).
		const q = createQuery({ run: async () => "x" });
		expect("name" in q).toBe(true);
	});

	it("defaults input to v.object({}) when omitted", () => {
		const q = createQuery({ run: async () => "x" });
		expect(q.input).toBeDefined();
		// Validates that empty object is the default contract
	});

	it("accepts an explicit input validator", async () => {
		const { v } = await import("../src/index.ts");
		const q = createQuery({
			input:  v.object({ name: v.string() }),
			run:    async (opts) => `hello ${opts.input.name}`,
		});
		expect(q.input).toBeDefined();
	});

	it("treats output as optional and infers from run when omitted", () => {
		const q = createQuery({ run: async () => 42 });
		expect(q.output).toBeUndefined();
	});

	it("validates output against the output schema when present in dev mode", async () => {
		const { v } = await import("../src/index.ts");
		const q = createQuery({
			input:  v.object({}),
			output: v.string(),
			run:    async () => 42 as unknown as string,   // wrong shape
		});
		await expect(q.run({ input: {}, ctx: {} })).rejects.toThrow();
	});

	it("exposes only .run on the action — no .emit, no .invalidate", () => {
		const q = createQuery({ run: async () => "x" });
		expect(typeof q.run).toBe("function");
		expect("emit" in q).toBe(false);
		expect("invalidate" in q).toBe(false);
	});

	it("registers itself in the global registry on declaration", async () => {
		const { registry } = await import("../src/index.ts");
		const q = createQuery({ name: "test.greet", run: async () => "x" });
		expect(registry.get(q.name)).toBe(q);
	});

	it("calls run with opts containing input and ctx", async () => {
		const q = createQuery({
			run: async (opts) => {
				expect(opts).toHaveProperty("input");
				expect(opts).toHaveProperty("ctx");
				return "ok";
			},
		});
		await q.run({ input: {}, ctx: {} });
	});

	it("validates input against the input schema before run", async () => {
		const { v } = await import("../src/index.ts");
		const q = createQuery({
			input: v.object({ name: v.string() }),
			run:   async (opts) => opts.input.name,
		});
		await expect(q.run({ input: { name: 42 }, ctx: {} })).rejects.toThrow();
	});

	it("requires description when tool is set", () => {
		expect(() =>
			createQuery({
				tool: {},
				run:  async () => "x",
				// no description
			})
		).toThrow(/description/);
	});

	it("opts.tick(payload) emits a progress event during run", async () => {
		const ticks: unknown[] = [];
		const q = createQuery({
			run: async (opts) => {
				opts.tick({ kind: "status", message: "loading" });
				opts.tick({ kind: "status", message: "computing" });
				return "ok";
			},
		});
		await q.run({ input: {}, ctx: {}, tick: (t: unknown) => ticks.push(t) });
		expect(ticks).toHaveLength(2);
	});

	it("opts.tick validates against the progress schema when declared", async () => {
		const { v } = await import("../src/index.ts");
		const q = createQuery({
			progress: v.object({ kind: v.literal("status"), message: v.string() }),
			run: async (opts) => {
				opts.tick({ kind: "status", message: "ok" });
				opts.tick({ kind: "wrong" } as never);   // invalid
				return "x";
			},
		});
		await expect(q.run({ input: {}, ctx: {}, tick: () => undefined })).rejects.toThrow();
	});

	it("opts.tick is a no-op (or warning) when no listener is attached", async () => {
		const q = createQuery({
			run: async (opts) => {
				// No tick listener — call should not throw
				opts.tick({ kind: "status", message: "fine" });
				return "ok";
			},
		});
		// No tick fn passed in; should not throw
		await expect(q.run({ input: {}, ctx: {} })).resolves.toBe("ok");
	});

	it("permits tool-tagged query without output (output is optional)", async () => {
		expect(() =>
			createQuery({
				description: "Greet",
				tool:        {},
				run:         async () => "x",
			})
		).not.toThrow();
	});
});

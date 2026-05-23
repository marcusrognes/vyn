import { describe, expect, it } from "vitest";
import { createSubscription } from "../src/index.ts";

// Contracts from /guide/realtime/ and /guide/actions/
describe("createSubscription", () => {
	it("returns an action record with kind 'subscription'", () => {
		const s = createSubscription({
			run: async function* () {},
		});
		expect(s.kind).toBe("subscription");
	});

	it("exposes both .run and .emit on the action", () => {
		const s = createSubscription({ run: async function* () {} });
		expect(typeof s.run).toBe("function");
		expect(typeof s.emit).toBe("function");
	});

	it("rejects when both `match` and `run` are present (single form only)", () => {
		expect(() =>
			createSubscription({
				// @ts-expect-error: match is no longer supported
				match: () => true,
				run:   async function* () {},
			})
		).toThrow();
	});

	it("requires run as an async generator", () => {
		expect(() =>
			createSubscription({
				// @ts-expect-error: regular async function is not allowed
				run: async () => "x",
			})
		).toThrow(/generator/);
	});

	it("opts.events is an AsyncIterable of values emitted via .emit", async () => {
		const s = createSubscription({
			run: async function* (opts) {
				for await (const v of opts.events) yield v;
			},
		});

		// Start consumer
		const consumer = s.run({ input: {}, ctx: {}, signal: new AbortController().signal });
		const iter = consumer[Symbol.asyncIterator]();

		// Emit a value
		s.emit("hello");

		const { value } = await iter.next();
		expect(value).toBe("hello");
	});

	it("each yielded value validates against output", async () => {
		const { v } = await import("../src/index.ts");
		const s = createSubscription({
			input:  v.object({}),
			output: v.string(),
			run:    async function* () {
				yield 42 as unknown as string;
			},
		});
		const iter = s.run({ input: {}, ctx: {}, signal: new AbortController().signal });
		await expect(iter.next()).rejects.toThrow();
	});

	it("opts.signal fires on client disconnect", async () => {
		const ctrl = new AbortController();
		let aborted = false;

		const s = createSubscription({
			run: async function* (opts) {
				opts.signal.addEventListener("abort", () => { aborted = true; });
				yield "first";
			},
		});

		const iter = s.run({ input: {}, ctx: {}, signal: ctrl.signal });
		await iter.next();
		ctrl.abort();
		expect(aborted).toBe(true);
	});

	it("RpcError thrown from run propagates to consumer", async () => {
		const { RpcError } = await import("../src/index.ts");
		const s = createSubscription({
			run: async function* () {
				throw new RpcError("forbidden", "no access");
			},
		});
		const iter = s.run({ input: {}, ctx: {}, signal: new AbortController().signal });
		await expect(iter.next()).rejects.toThrow(RpcError);
	});

	it("registers itself in the global registry on declaration", async () => {
		const { registry } = await import("../src/index.ts");
		const s = createSubscription({
			name: "test.onCreated",
			run:  async function* () {},
		});
		expect(registry.get(s.name)).toBe(s);
	});
});

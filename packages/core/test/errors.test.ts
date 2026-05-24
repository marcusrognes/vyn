import { describe, expect, it } from "vyn:test";
import { RpcError } from "../src/index.ts";

// Contracts from /guide/errors/
describe("RpcError", () => {
	it("constructs with category, message, optional details", () => {
		const e = new RpcError("forbidden", "no access", { resource: "note" });
		expect(e.category).toBe("forbidden");
		expect(e.message).toBe("no access");
		expect(e.details).toEqual({ resource: "note" });
	});

	it("extends Error", () => {
		const e = new RpcError("not_found", "missing");
		expect(e).toBeInstanceOf(Error);
		expect(e).toBeInstanceOf(RpcError);
	});

	it("has .stack", () => {
		const e = new RpcError("internal", "oops");
		expect(typeof e.stack).toBe("string");
	});

	it("name is 'RpcError'", () => {
		const e = new RpcError("internal", "x");
		expect(e.name).toBe("RpcError");
	});

	describe("category set", () => {
		const documented = [
			"unauthorized",
			"forbidden",
			"not_found",
			"conflict",
			"bad_request",
			"rate_limited",
			"internal",
		] as const;

		it.each(documented)("accepts the documented category '%s'", (cat) => {
			const e = new RpcError(cat, "msg");
			expect(e.category).toBe(cat);
		});
	});

	describe("RPC surface mapping (HTTP status)", () => {
		// Mapping documented in /guide/errors/#categories
		// The mapping function lives in @vynjs/server; we re-export here for testing.
		it.each([
			["unauthorized", 401],
			["forbidden", 403],
			["not_found", 404],
			["conflict", 409],
			["bad_request", 400],
			["rate_limited", 429],
			["internal", 500],
		])("'%s' maps to HTTP %i", async (category, expectedStatus) => {
			// Import lazily to defer the cross-package coupling
			const { categoryToStatus } = await import("../src/index.ts");
			expect(categoryToStatus(category as never)).toBe(expectedStatus);
		});
	});

	describe("serialization", () => {
		it("toJSON() yields { category, message, details } — for wire transmission", () => {
			const e = new RpcError("not_found", "missing", { id: "x" });
			expect(e.toJSON()).toEqual({
				category: "not_found",
				message: "missing",
				details: { id: "x" },
			});
		});

		it("does NOT include .stack in toJSON output (server-only)", () => {
			const e = new RpcError("internal", "x");
			expect(e.toJSON()).not.toHaveProperty("stack");
		});
	});
});

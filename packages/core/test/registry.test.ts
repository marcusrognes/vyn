import { describe, expect, it, beforeEach } from "vyn:test";
import { createQuery, createMutation, createSubscription, registry } from "../src/index.ts";

// Contracts from /guide/actions/#the-registry
describe("registry", () => {
	beforeEach(() => {
		// Tests run in isolation; the registry must support a clean state
		// per test. The implementation provides a way to reset.
		(registry as any).clear?.();
	});

	it("list() returns every declared action", () => {
		const q = createQuery({ name: "test.a", run: async () => "x" });
		const m = createMutation({ name: "test.b", run: async () => undefined });
		expect(registry.list()).toContain(q);
		expect(registry.list()).toContain(m);
	});

	it("get(name) returns the action by name", () => {
		const q = createQuery({ name: "test.x", run: async () => "x" });
		expect(registry.get("test.x")).toBe(q);
	});

	it("get(name) returns undefined for unknown names", () => {
		expect(registry.get("nonexistent")).toBeUndefined();
	});

	it("byKind('query') filters by kind", () => {
		const q = createQuery({ name: "q1", run: async () => "x" });
		const m = createMutation({ name: "m1", run: async () => undefined });
		expect(registry.byKind("query")).toContain(q);
		expect(registry.byKind("query")).not.toContain(m);
		expect(registry.byKind("mutation")).toContain(m);
	});

	it("byKind('mutation') and ('subscription') work", () => {
		const s = createSubscription({ name: "s1", run: async function* () {} });
		expect(registry.byKind("subscription")).toContain(s);
	});

	it("byTool() returns actions with a tool field", () => {
		const q = createQuery({
			name:        "q.tooled",
			description: "x",
			tool:        {},
			output:      {} as any,
			run:         async () => "x",
		});
		expect(registry.byTool()).toContain(q);
	});

	it("byTool({ category }) filters by tool.category", () => {
		const q = createQuery({
			name:        "q.notes.list",
			description: "x",
			tool:        { category: "notes" },
			output:      {} as any,
			run:         async () => "x",
		});
		expect(registry.byTool({ category: "notes" })).toContain(q);
	});

	it("schema() returns a JSON-Schema bundle of every input + output", () => {
		const q = createQuery({ name: "q.x", run: async () => "x" });
		const schema = registry.schema();
		expect(schema).toBeDefined();
		expect(schema[q.name]).toBeDefined();
	});

	it("name is derived from file path + export by codegen (not set in source)", () => {
		// Codegen sets .name on action records before they're registered.
		// At test time we assert the framework READS .name as the registry key.
		const q = createQuery({ name: "x.y.z", run: async () => "x" });
		expect(q.name).toBe("x.y.z");
		expect(registry.get("x.y.z")).toBe(q);
	});

	it("duplicate names throw at registration time", () => {
		createQuery({ name: "dupe", run: async () => "x" });
		expect(() =>
			createQuery({ name: "dupe", run: async () => "y" })
		).toThrow(/duplicate/);
	});
});

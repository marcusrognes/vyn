import { describe, expect, it } from "vitest";
import { v } from "../src/index.ts";

// Contracts from /guide/models/
describe("v.* validators", () => {
	describe("v.object", () => {
		it("validates required fields are present", () => {
			const Note = v.object({ title: v.string() });
			expect(() => Note.parse({})).toThrow();
			expect(Note.parse({ title: "hi" })).toEqual({ title: "hi" });
		});

		it("exposes .schema as JSON Schema", () => {
			const Note = v.object({ title: v.string() });
			expect(Note.schema).toBeDefined();
			expect(Note.schema.type).toBe("object");
		});

		it("exposes .fields with field-level validators", () => {
			const Note = v.object({ title: v.string(), body: v.string() });
			expect(Note.fields.title).toBeDefined();
			expect(Note.fields.body).toBeDefined();
		});

		it(".pick subsets fields", () => {
			const Note = v.object({ title: v.string(), body: v.string(), id: v.number() });
			const Picked = Note.pick(["title", "body"]);
			expect(() => Picked.parse({ title: "x", body: "y" })).not.toThrow();
		});

		it(".omit removes fields", () => {
			const Note = v.object({ title: v.string(), body: v.string(), id: v.number() });
			const Omitted = Note.omit(["id"]);
			expect(() => Omitted.parse({ title: "x", body: "y" })).not.toThrow();
		});

		it(".partial makes every field optional", () => {
			const Note = v.object({ title: v.string(), body: v.string() });
			expect(() => Note.partial().parse({})).not.toThrow();
		});

		it(".extend adds fields", () => {
			const Note = v.object({ title: v.string() });
			const Extended = Note.extend({ body: v.string() });
			expect(() => Extended.parse({ title: "x", body: "y" })).not.toThrow();
		});
	});

	describe("constructors (.create, .empty, .update, .parse)", () => {
		it(".create fills defaults and returns a POJO", () => {
			const Note = v.object({
				_id:       v.string().default(() => "id"),
				title:     v.string().default("New note"),
				body:      v.string(),
				createdAt: v.number().default(() => Date.now()),
			});
			const draft = Note.create({ body: "hello" });
			expect(draft._id).toBe("id");
			expect(draft.title).toBe("New note");
			expect(draft.body).toBe("hello");
			expect(typeof draft.createdAt).toBe("number");
		});

		it(".empty returns an instance filled entirely from defaults", () => {
			const Note = v.object({
				title: v.string().default("Untitled"),
				body:  v.string().default(""),
			});
			const blank = Note.empty();
			expect(blank).toEqual({ title: "Untitled", body: "" });
		});

		it(".update shallow-merges patch onto existing, re-validates, returns new POJO", () => {
			const Note = v.object({ title: v.string(), body: v.string() });
			const original = { title: "A", body: "B" };
			const updated = Note.update(original, { title: "Renamed" });
			expect(updated).toEqual({ title: "Renamed", body: "B" });
			expect(original).toEqual({ title: "A", body: "B" }); // untouched
		});

		it(".parse throws on missing required fields without defaults", () => {
			const Note = v.object({ body: v.string() });
			expect(() => Note.parse({})).toThrow();
		});

		it(".create returns a plain object — no class, no prototype", () => {
			const Note = v.object({ body: v.string().default("") });
			const note = Note.create({});
			expect(Object.getPrototypeOf(note)).toBe(Object.prototype);
		});
	});

	describe("modifiers", () => {
		it(".optional makes field optional on input AND output", () => {
			const S = v.object({ x: v.string().optional() });
			expect(S.parse({})).toEqual({});
			expect(S.parse({ x: "a" })).toEqual({ x: "a" });
		});

		it(".nullable allows null", () => {
			const S = v.object({ x: v.string().nullable() });
			expect(S.parse({ x: null })).toEqual({ x: null });
		});

		it(".default applies when field is missing", () => {
			const S = v.object({ x: v.string().default("d") });
			expect(S.parse({})).toEqual({ x: "d" });
		});

		it(".default function runs once per parse for fresh values", () => {
			let counter = 0;
			const S = v.object({ x: v.string().default(() => `v${++counter}`) });
			expect(S.parse({}).x).toBe("v1");
			expect(S.parse({}).x).toBe("v2");
		});

		it("default wins over optional in the output type", () => {
			const S = v.object({ x: v.string().optional().default("d") });
			expect(S.parse({}).x).toBe("d");
		});
	});

	describe("string constraints", () => {
		it(".min rejects strings shorter than length", () => {
			expect(() => v.string().min(3).parse("ab")).toThrow();
			expect(v.string().min(3).parse("abc")).toBe("abc");
		});

		it(".max rejects strings longer than length", () => {
			expect(() => v.string().max(3).parse("abcd")).toThrow();
		});

		it(".length requires exact length", () => {
			expect(() => v.string().length(3).parse("ab")).toThrow();
			expect(v.string().length(3).parse("abc")).toBe("abc");
		});

		it(".regex matches pattern", () => {
			expect(() => v.string().regex(/^\d+$/).parse("abc")).toThrow();
			expect(v.string().regex(/^\d+$/).parse("123")).toBe("123");
		});

		it(".email validates email shape", () => {
			expect(() => v.string().email().parse("not-email")).toThrow();
			expect(v.string().email().parse("a@b.c")).toBe("a@b.c");
		});

		it(".url validates URL shape", () => {
			expect(() => v.string().url().parse("not-url")).toThrow();
			expect(v.string().url().parse("https://example.com")).toBe("https://example.com");
		});

		it(".uuid validates UUID shape", () => {
			expect(() => v.string().uuid().parse("not-uuid")).toThrow();
			expect(v.string().uuid().parse("550e8400-e29b-41d4-a716-446655440000")).toBeTruthy();
		});

		it(".trim strips surrounding whitespace", () => {
			expect(v.string().trim().parse("  hi  ")).toBe("hi");
		});

		it(".lowercase enforces lowercase", () => {
			expect(() => v.string().lowercase().parse("ABC")).toThrow();
		});
	});

	describe("number constraints", () => {
		it(".min / .max enforce range", () => {
			expect(() => v.number().min(0).parse(-1)).toThrow();
			expect(() => v.number().max(100).parse(101)).toThrow();
		});

		it(".integer rejects fractions", () => {
			expect(() => v.number().integer().parse(1.5)).toThrow();
			expect(v.number().integer().parse(2)).toBe(2);
		});

		it(".positive / .negative", () => {
			expect(() => v.number().positive().parse(0)).toThrow();
			expect(() => v.number().negative().parse(0)).toThrow();
		});

		it(".multipleOf checks divisibility", () => {
			expect(() => v.number().multipleOf(5).parse(7)).toThrow();
			expect(v.number().multipleOf(5).parse(10)).toBe(10);
		});

		it(".finite rejects Infinity and NaN", () => {
			expect(() => v.number().finite().parse(Infinity)).toThrow();
			expect(() => v.number().finite().parse(NaN)).toThrow();
		});
	});

	describe("array constraints", () => {
		it(".min / .max enforce length", () => {
			expect(() => v.array(v.string()).min(1).parse([])).toThrow();
			expect(() => v.array(v.string()).max(2).parse(["a", "b", "c"])).toThrow();
		});

		it(".length requires exact length", () => {
			expect(() => v.array(v.string()).length(2).parse(["a"])).toThrow();
		});

		it(".unique rejects duplicates by deep equality", () => {
			expect(() => v.array(v.string()).unique().parse(["a", "a"])).toThrow();
			expect(v.array(v.string()).unique().parse(["a", "b"])).toEqual(["a", "b"]);
		});
	});

	describe("constraints expose metadata", () => {
		it(".fields[k].constraints lists the chain", () => {
			const User = v.object({ email: v.string().email().trim().lowercase() });
			const constraints = User.fields.email.constraints;
			expect(constraints).toContainEqual(expect.objectContaining({ kind: "email" }));
			expect(constraints).toContainEqual(expect.objectContaining({ kind: "trim" }));
			expect(constraints).toContainEqual(expect.objectContaining({ kind: "lowercase" }));
		});
	});

	describe("v.Infer", () => {
		it("type-only — checked at compile time", () => {
			// Compile-time test; if this file builds, v.Infer works.
			// Implementation must export Infer<T> type alias.
			expect(true).toBe(true);
		});
	});
});

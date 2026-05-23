import { describe, expect, it } from "vyn:test";
import { v } from "../src/index.ts";

// Models page is mostly covered by v.test.ts; this file pins the
// integration-shaped contracts from /guide/models/.
describe("Models", () => {
	it("Schema/Type naming convention: const NoteSchema + type Note", () => {
		const NoteSchema = v.object({
			_id:   v.string().uuid().default(() => "id"),
			title: v.string().default("New note"),
			body:  v.string(),
		});
		type Note = ReturnType<typeof NoteSchema.parse>;
		const note: Note = NoteSchema.create({ body: "hi" });
		expect(note.body).toBe("hi");
	});

	it("create / empty / update / parse produce structurally identical POJOs", () => {
		const S = v.object({
			a: v.string().default("a"),
			b: v.string().default("b"),
		});
		const created = S.create({});
		const empty   = S.empty();
		const parsed  = S.parse({});
		expect(created).toEqual(empty);
		expect(created).toEqual(parsed);
	});

	it("update returns a new object — original is untouched", () => {
		const S = v.object({ a: v.string(), b: v.string() });
		const orig = { a: "1", b: "2" };
		const next = S.update(orig, { a: "X" });
		expect(orig).toEqual({ a: "1", b: "2" });
		expect(next).toEqual({ a: "X", b: "2" });
		expect(next).not.toBe(orig);
	});

	it("derivations: .pick / .omit / .partial chain", () => {
		const NoteSchema = v.object({
			_id:   v.string(),
			title: v.string(),
			body:  v.string(),
		});
		const NoteCreate = NoteSchema.pick(["title", "body"]);
		const NotePatch  = NoteSchema.pick(["title", "body"]).partial();
		expect(() => NoteCreate.parse({ title: "x", body: "y" })).not.toThrow();
		expect(() => NotePatch.parse({})).not.toThrow();
	});

	it("default with function runs once per parse", () => {
		const ids: string[] = [];
		const S = v.object({ id: v.string().default(() => `id-${ids.length}`) });
		ids.push(S.parse({}).id);
		ids.push(S.parse({}).id);
		expect(ids[0]).not.toBe(ids[1]);
	});

	it("input shape: only required-without-default fields must be supplied", () => {
		const NoteSchema = v.object({
			_id:       v.string().default(() => "id"),
			title:     v.string().default("Untitled"),
			body:      v.string(),
			createdAt: v.number().default(() => 0),
		});
		// Only `body` is required input.
		const note = NoteSchema.create({ body: "hi" });
		expect(note.body).toBe("hi");
		expect(note._id).toBe("id");
		expect(note.title).toBe("Untitled");
	});
});

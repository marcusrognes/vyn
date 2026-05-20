import { createQuery, createMutation, createSubscription, v, RpcError } from "@vyn/core";
import { NoteSchema, type Note } from "./note.ts";
import { requireSession } from "../auth/guards.ts";
import type { Ctx } from "../../ctx.ts";

export const list = createQuery({
	name:        "notes.list",
	description: "List the current user's notes, newest first.",
	input:       v.object({}),
	output:      v.array(NoteSchema),
	run: async (opts: { input: {}; ctx: Ctx }) => {
		const { userId } = requireSession(opts);
		return [...opts.ctx.notes.values()]
			.filter((n) => n.userId === userId)
			.sort((a, b) => b.updatedAt - a.updatedAt);
	},
});

export const get = createQuery({
	name:        "notes.get",
	description: "Fetch a single note by id.",
	input:       v.object({ _id: v.string().uuid() }),
	output:      NoteSchema,
	run: async (opts: { input: { _id: string }; ctx: Ctx }) => {
		const { userId } = requireSession(opts);
		const note = opts.ctx.notes.get(opts.input._id);
		if (!note || note.userId !== userId) throw new RpcError("not_found", "note not found");
		return note;
	},
});

export const onChanged = createSubscription({
	name:        "notes.onChanged",
	description: "Stream the current user's note changes.",
	input:       v.object({}),
	output:      v.object({ kind: v.string(), note: NoteSchema }),
	run: async function* (opts) {
		const ctx = opts.ctx as Ctx;
		requireSession({ ctx });
		for await (const event of opts.events) {
			const e = event as { kind: string; note: Note };
			if (e.note.userId === ctx.userId) yield e;
		}
	},
});

export const create = createMutation({
	name:        "notes.create",
	description: "Create a note.",
	input:       v.object({ title: v.string().optional(), body: v.string().optional() }),
	output:      NoteSchema,
	tool:        {},
	run: async (opts: { input: { title?: string; body?: string }; ctx: Ctx }) => {
		const { userId } = requireSession(opts);
		const note = NoteSchema.create({ ...opts.input, userId });
		opts.ctx.notes.set(note._id, note);
		onChanged.emit({ kind: "added", note });
		return note;
	},
});

export const update = createMutation({
	name:        "notes.update",
	description: "Update a note.",
	input:       v.object({
		_id:   v.string().uuid(),
		title: v.string().optional(),
		body:  v.string().optional(),
	}),
	output:      NoteSchema,
	tool:        {},
	run: async (opts: { input: { _id: string; title?: string; body?: string }; ctx: Ctx }) => {
		const { userId } = requireSession(opts);
		const existing = opts.ctx.notes.get(opts.input._id);
		if (!existing || existing.userId !== userId) throw new RpcError("not_found", "note not found");
		const updated: Note = { ...existing, ...opts.input, updatedAt: Date.now() };
		opts.ctx.notes.set(updated._id, updated);
		onChanged.emit({ kind: "updated", note: updated });
		return updated;
	},
});

export const remove = createMutation({
	name:        "notes.remove",
	description: "Delete a note.",
	input:       v.object({ _id: v.string().uuid() }),
	tool:        {},
	run: async (opts: { input: { _id: string }; ctx: Ctx }) => {
		const { userId } = requireSession(opts);
		const existing = opts.ctx.notes.get(opts.input._id);
		if (!existing || existing.userId !== userId) throw new RpcError("not_found", "note not found");
		opts.ctx.notes.delete(opts.input._id);
		onChanged.emit({ kind: "removed", note: existing });
	},
});

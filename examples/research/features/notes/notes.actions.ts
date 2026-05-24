import { createMutation, createQuery, RpcError, v } from "@vynjs/core";
import type { Ctx, Note } from "../../ctx.ts";

const NoteShape = v.object({
	_id: v.string().uuid(),
	title: v.string(),
	body: v.string(),
	tags: v.array(v.string()),
	props: v.map(v.string(), v.unknown()),
	createdAt: v.date(),
});

export const list = createQuery({
	name: "notes.list",
	input: v.object({}),
	output: v.array(NoteShape),
	run: async (opts: { input: {}; ctx: Ctx }) =>
		[...opts.ctx.notes.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
});

export const create = createMutation({
	name: "notes.create",
	input: v.object({
		title: v.string().min(1).max(280),
		body: v.string().default(""),
		tags: v.array(v.string()).default(() => []),
	}),
	output: NoteShape,
	run: async (
		opts: { input: { title: string; body: string; tags: string[] }; ctx: Ctx },
	) => {
		const note: Note = {
			_id: crypto.randomUUID(),
			title: opts.input.title,
			body: opts.input.body,
			tags: opts.input.tags,
			props: new Map(),
			createdAt: new Date(),
		};
		opts.ctx.notes.set(note._id, note);
		return note;
	},
});

export const remove = createMutation({
	name: "notes.remove",
	description: "Delete a note by id.",
	input: v.object({ _id: v.string().uuid() }),
	tool: {},
	run: async (opts: { input: { _id: string }; ctx: Ctx }) => {
		if (!opts.ctx.notes.delete(opts.input._id)) {
			throw new RpcError("not_found", "note not found");
		}
	},
});

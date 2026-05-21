---
title: 2 · Notes
description: Note model with rich types, CRUD actions, tag-based search, realtime subscription. SuperJSON keeps Date and Map intact end-to-end.
sidebar:
  order: 2
---

Build the notes feature. The model uses `Date`, `Map`, and `Set` so
SuperJSON's value pays off; queries scope to the user; one
subscription streams changes.

## Auth (briefly)

Drop in an auth feature mirroring the earlier auth tutorial — the
mechanics don't change. The relevant outputs are: a `requireSession`
guard and `signup` / `login` / `logout` mutations. See
[Build notes with auth](/vyn/tutorials/build-notes-with-auth/) for the
full code; this tutorial assumes you've ported those files (in the
new tutorial they live at `features/auth/`).

The only change worth noting: store sessions in MongoDB instead of
SQLite, using the `sessions` collection from `db.ts`. The token
generation and password hashing are identical.

## The Note model

```ts
// features/notes/note.ts
import { v } from "@vyn/core";
import { uuid } from "@vyn/core/util";

// Embedding vectors are stored alongside notes. SuperJSON lets us
// hand them off as a Float32Array on the wire without coercing.
export const NoteSchema = v.object({
	_id:        v.string().uuid().default(() => uuid()),
	userId:     v.string().uuid(),
	title:      v.string().min(1).max(280).default("Untitled"),
	body:       v.string().default(""),
	tags:       v.array(v.string().min(1)).max(20).default(() => []),
	citations:  v.array(v.string().url()).default(() => []),
	embedding:  v.instanceOf(Float32Array).optional(),
	properties: v.map(v.string(), v.unknown()).default(() => new Map()),
	createdAt:  v.date().default(() => new Date()),
	updatedAt:  v.date().default(() => new Date()),
});

export type Note = v.Infer<typeof NoteSchema>;
```

Three rich types that JSON alone can't carry:

- `Float32Array` for the embedding vector
- `Map<string, unknown>` for free-form per-note properties
- `Date` for timestamps

With SuperJSON wired (from the setup step), these survive the round
trip from server to client and back — `note.createdAt` is a real
`Date` on the client, `note.embedding[0]` is a `number` indexed from
a `Float32Array`, `note.properties.get(key)` works.

## Actions

```ts
// features/notes/notes.actions.ts
import { createQuery, createMutation, createSubscription, v, RpcError } from "@vyn/core";
import type { Ctx } from "../../ctx.ts";
import { NoteSchema, type Note } from "./note.ts";
import { requireSession } from "../auth/guards.ts";

export const list = createQuery({
	description: "List the current user's notes, newest first.",
	input:  v.object({
		query: v.string().optional(),
		tags:  v.array(v.string()).optional(),
		limit: v.number().min(1).max(100).default(50),
	}),
	output: v.array(NoteSchema),
	run: async (opts: { input: { query?: string; tags?: string[]; limit: number }; ctx: Ctx }) => {
		const session = requireSession(opts);

		const filter: Record<string, unknown> = { userId: session.userId };
		if (opts.input.tags?.length) filter.tags = { $all: opts.input.tags };
		if (opts.input.query)        filter.$text = { $search: opts.input.query };

		return opts.ctx.db.notes
			.find(filter)
			.sort({ updatedAt: -1 })
			.limit(opts.input.limit)
			.toArray();
	},
});

export const get = createQuery({
	description: "Fetch a single note by id.",
	input:  v.object({ _id: v.string().uuid() }),
	output: NoteSchema,
	run: async (opts: { input: { _id: string }; ctx: Ctx }) => {
		const session = requireSession(opts);
		const doc = await opts.ctx.db.notes.findOne({ _id: opts.input._id, userId: session.userId });
		if (!doc) throw new RpcError("not_found", "no such note");
		return doc;
	},
});

export const onChanged = createSubscription({
	description: "Stream the current user's note changes.",
	input:  v.object({}),
	output: v.object({
		kind: v.string(),
		note: NoteSchema,
	}),
	run: async function* (opts: { input: {}; ctx: Ctx; events: AsyncIterable<{ kind: string; note: Note }>; signal: AbortSignal }) {
		requireSession(opts);
		for await (const event of opts.events) {
			if (event.note.userId === opts.ctx.userId) yield event;
		}
	},
});

export const create = createMutation({
	description: "Create a note.",
	input:  NoteSchema.pick(["title", "body", "tags"]).partial(),
	output: NoteSchema,
	tool:   {},
	run: async (opts: { input: Partial<Note>; ctx: Ctx }) => {
		const session = requireSession(opts);
		const note = NoteSchema.create({ ...opts.input, userId: session.userId });
		await opts.ctx.db.notes.insertOne(note);
		onChanged.emit({ kind: "added", note });
		return note;
	},
});

export const update = createMutation({
	description: "Update a note's title, body, or tags.",
	input: v.object({
		_id:   v.string().uuid(),
		title: v.string().min(1).max(280).optional(),
		body:  v.string().optional(),
		tags:  v.array(v.string()).optional(),
	}),
	output: NoteSchema,
	tool:   {},
	run: async (opts) => {
		const session = requireSession(opts);
		const existing = await opts.ctx.db.notes.findOne({ _id: opts.input._id, userId: session.userId });
		if (!existing) throw new RpcError("not_found", "no such note");

		const patch = { ...opts.input, updatedAt: new Date() };
		const updated = NoteSchema.update(existing, patch);
		await opts.ctx.db.notes.replaceOne({ _id: updated._id }, updated);
		onChanged.emit({ kind: "updated", note: updated });
		return updated;
	},
});

export const remove = createMutation({
	description: "Delete a note.",
	input:  v.object({ _id: v.string().uuid() }),
	tool:   {},
	run: async (opts) => {
		const session = requireSession(opts);
		const existing = await opts.ctx.db.notes.findOne({ _id: opts.input._id, userId: session.userId });
		if (!existing) throw new RpcError("not_found", "no such note");
		await opts.ctx.db.notes.deleteOne({ _id: opts.input._id });
		onChanged.emit({ kind: "removed", note: existing });
	},
});
```

Things to notice:

- **Mongo's text index** powers the `query` input. The `$text` search
  is the simplest path; for richer relevance, swap to Atlas Search
  or a vector store using `embedding`.
- **Tag filtering** is `tags: { $all: [...] }` — AND semantics. For
  OR semantics, use `$in`.
- **SuperJSON** does the heavy lifting at the wire boundary. The
  server reads `note.createdAt` as a `Date` from MongoDB; the
  client gets a `Date` too. No manual coercion.
- Mutations all emit on `onChanged` with the kind discriminator; the
  subscription filters by `ctx.userId` per receiver.

## What the client sees

```ts
// public/routes/index.js
import { createApp } from "@vyn/client";
import { transformer } from "../../transform.ts";
import type { AppRouter } from "../../_vyn.gen.ts";

const { rpc } = createApp<AppRouter>({ transformer });

const notes = await rpc.notes.list.query({});
notes[0].createdAt instanceof Date;        // → true
notes[0].properties instanceof Map;        // → true
```

The client transformer must match the server. We import the same
`transform.ts` module so they share one source of truth.

## Tags as a separate query

For a tag-cloud sidebar:

```ts
export const tagCloud = createQuery({
	description: "Tag counts for the current user.",
	input:  v.object({}),
	output: v.array(v.object({ tag: v.string(), count: v.number() })),
	run: async (opts: { input: {}; ctx: Ctx }) => {
		const session = requireSession(opts);
		const cursor = opts.ctx.db.notes.aggregate<{ _id: string; count: number }>([
			{ $match: { userId: session.userId } },
			{ $unwind: "$tags" },
			{ $group: { _id: "$tags", count: { $sum: 1 } } },
			{ $sort:  { count: -1 } },
			{ $limit: 50 },
		]);
		const rows = await cursor.toArray();
		return rows.map((r) => ({ tag: r._id, count: r.count }));
	},
});
```

## Try it

Bring the dev server up, sign up a user (assuming you ported the
auth feature), and try the actions from the in-process MCP
endpoint or the typed RPC client. The end-to-end Date / Map / Set
round trip is the win — confirm with `typeof` in browser devtools.

## Where you are

Notes work. CRUD with rich types via SuperJSON, tag-based filtering,
text search, realtime subscription scoped per-user. Tooling-wise:

- Action registry is populated with 5 actions (3 queries, 3 mutations,
  1 subscription)
- `tool: {}` is set on the mutations so MCP exposes them too
- The realtime subscription filters by user in `run`, not by
  declarative match — straight from
  [`/guide/realtime/`](/vyn/guide/realtime/)

Continue to **[3 · Agent](../3-agent/)** to add the AI assistant
that searches your notes and the web, streams its thinking, and
returns a structured answer.

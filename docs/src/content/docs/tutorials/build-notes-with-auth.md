---
title: Build notes with auth
description: A complete notes app with SQLite persistence, session-cookie authentication, per-user scoping, components, and realtime updates.
sidebar:
  order: 2
---

This tutorial builds a small notes app with real authentication and
real persistence. You'll wire up an env schema, a SQLite-backed
static ctx, a session-cookie dynamic ctx, per-user scoped actions,
parameterized routes, and a couple of components. The result is a
single-user-multi-account app that another person could sign up for
and use.

By the end you'll have:

- typed env with `v.object({...}).parse(...)`,
- a SQLite database opened once at boot in `staticContext`,
- session cookies wired through `createContext`,
- signup / login / logout actions with password hashing,
- per-user-scoped notes with realtime updates,
- a parameterized `/notes/:noteId/` route,
- reusable `<note-card>` and `<auth-form>` components.

The whole app is around 400 lines of code.

## Prerequisites

- Finish the [todo app tutorial](/tutorials/build-a-todo/) first — this
  tutorial assumes you understand actions, models, components, and
  routes.
- Vyn installed. See [Getting started](/getting-started/) for the
  install step on your runtime of choice.
- A working directory: `mkdir notes && cd notes && vyn init`.

## What you're building

```
notes/                                    project root
├── vyn.config.ts                         actionsRoot: "features"
├── env.ts                                typed env vars
├── server.ts                             server boot
├── _db.ts                                SQLite handle + migrations
├── _ctx.ts                               Ctx type
├── features/
│   ├── auth/
│   │   ├── user.ts                       User schema
│   │   ├── _session.ts                   session helpers (read, refresh, clear)
│   │   ├── _require.ts                   throw-on-no-session helper
│   │   ├── auth.actions.ts               signup, login, logout, me
│   │   └── auth-form.component.ts        reusable signup / login form
│   └── notes/
│       ├── note.ts                       Note schema
│       ├── notes.actions.ts              list, get, create, update, remove, onChanged
│       └── note-card.component.ts        one note in a list
└── public/
    ├── index.html                        SPA shell
    ├── style.css
    └── routes/
        ├── index.html                    / — notes list (auth required)
        ├── index.ts
        ├── login.html                    /login
        ├── login.ts
        ├── signup.html                   /signup
        ├── signup.ts
        └── notes/
            ├── [noteId].html             /notes/:noteId
            └── [noteId].ts
```

Files prefixed with `_` are framework-invisible — neither route
discovery nor actions discovery descends into them. They are app
internals that get imported by name.

## Step 1 — env

Declare every variable as a schema. Boot fails fast if anything is
missing or malformed:

```ts
// env.ts
import { v } from "@vyn/core";

export const env = v.object({
	DATABASE_URL:   v.string().default("./notes.db"),
	SESSION_SECRET: v.string().min(32),
	PORT:           v.string().regex(/^\d+$/).default("8000"),
	NODE_ENV:       v.string().regex(/^(development|production|test)$/).default("development"),
}).parse(
	typeof Deno !== "undefined" ? Deno.env.toObject() : process.env,
);
```

Create a `.env.example`:

```
SESSION_SECRET=replace-me-with-32-random-bytes-please
```

Copy it to `.env` and pick a real secret (`openssl rand -hex 32`).

## Step 2 — the database

A small file holds the connection and the migrations. Vyn does not own
your data layer; this is just plain TypeScript using `node:sqlite`
(available in both Deno and Node 22+).

```ts
// _db.ts
import { DatabaseSync } from "node:sqlite";
import { env } from "./env.ts";

export type Database = DatabaseSync;

const MIGRATIONS = [
	`CREATE TABLE IF NOT EXISTS users (
		_id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		passwordHash TEXT NOT NULL,
		createdAt INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS sessions (
		token TEXT PRIMARY KEY,
		userId TEXT NOT NULL,
		expiresAt INTEGER NOT NULL,
		FOREIGN KEY(userId) REFERENCES users(_id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS notes (
		_id TEXT PRIMARY KEY,
		userId TEXT NOT NULL,
		title TEXT NOT NULL,
		body TEXT NOT NULL,
		createdAt INTEGER NOT NULL,
		updatedAt INTEGER NOT NULL,
		FOREIGN KEY(userId) REFERENCES users(_id) ON DELETE CASCADE
	)`,
];

export function openDb(url = env.DATABASE_URL): Database {
	const db = new DatabaseSync(url);
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA foreign_keys = ON");
	for (const sql of MIGRATIONS) db.exec(sql);
	return db;
}
```

Migrations run on every boot. The `CREATE TABLE IF NOT EXISTS` form
makes that safe.

## Step 3 — the Ctx type

Declare what the layers contain. This lets every action's `opts.ctx`
type as the full picture without re-stating the shape per file.

```ts
// _ctx.ts
import type { BaseCtx } from "@vyn/server";
import type { Database } from "./_db.ts";
import type { Session } from "./features/auth/_session.ts";

export type StaticCtx  = { db: Database };
export type DynamicCtx = { session: Session | null };
export type Ctx        = BaseCtx & StaticCtx & DynamicCtx;
```

## Step 4 — sessions

The auth helpers know how to read, refresh, and clear a session
cookie. They live in the auth feature folder, prefixed with `_` so
discovery ignores them.

```ts
// features/auth/_session.ts
import { randomBytes } from "node:crypto";
import type { Database } from "../../_db.ts";
import { env } from "../../env.ts";

export type Session = { token: string; userId: string; expiresAt: number };

const COOKIE = "session";
const TTL_MS = 1000 * 60 * 60 * 24 * 30;   // 30 days

export function newToken() {
	return randomBytes(32).toString("hex");
}

export function readSession(req: Request, db: Database): Session | null {
	const token = parseCookie(req.headers.get("cookie") ?? "", COOKIE);
	if (!token) return null;
	const row = db
		.prepare("SELECT * FROM sessions WHERE token = ? AND expiresAt > ?")
		.get(token, Date.now()) as Session | undefined;
	return row ?? null;
}

export function issueSession(
	userId: string,
	db: Database,
	setCookie: (name: string, value: string, opts?: object) => void,
): Session {
	const session: Session = {
		token: newToken(),
		userId,
		expiresAt: Date.now() + TTL_MS,
	};
	db.prepare("INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)")
		.run(session.token, session.userId, session.expiresAt);
	setCookie(COOKIE, session.token, {
		httpOnly: true,
		sameSite: "Lax",
		secure:   env.NODE_ENV === "production",
		path:     "/",
		maxAge:   TTL_MS / 1000,
	});
	return session;
}

export function clearSession(
	token: string,
	db: Database,
	setCookie: (name: string, value: string, opts?: object) => void,
) {
	db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
	setCookie(COOKIE, "", { path: "/", maxAge: 0 });
}

function parseCookie(header: string, name: string): string | undefined {
	for (const part of header.split(/;\s*/)) {
		const [k, v] = part.split("=");
		if (k === name) return decodeURIComponent(v ?? "");
	}
}
```

A small helper that throws if there's no session — used at the top of
authenticated actions:

```ts
// features/auth/_require.ts
import { RpcError } from "@vyn/core";
import type { Ctx } from "../../_ctx.ts";

export function requireSession(opts: { ctx: Ctx }) {
	if (!opts.ctx.session) {
		throw new RpcError("unauthorized", "not signed in");
	}
	return opts.ctx.session;
}
```

When a [Guards](/guide/guards/) page lands, this helper becomes a
proper guard registered against actions. For now the inline pattern is
clear and short.

## Step 5 — the auth actions

```ts
// features/auth/user.ts
import { v } from "@vyn/core";
import { uuid } from "@vyn/core/util";

export const UserSchema = v.object({
	_id:          v.string().uuid().default(() => uuid()),
	email:        v.string().email().trim().lowercase(),
	passwordHash: v.string(),
	createdAt:    v.number().default(() => Date.now()),
});

export type User = v.Infer<typeof UserSchema>;

export const UserPublicSchema = UserSchema.omit(["passwordHash"]);
export type UserPublic = v.Infer<typeof UserPublicSchema>;
```

```ts
// features/auth/auth.actions.ts
import { createMutation, createQuery, v, RpcError } from "@vyn/core";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { Ctx } from "../../_ctx.ts";
import { UserSchema, UserPublicSchema, type UserPublic } from "./user.ts";
import { issueSession, clearSession } from "./_session.ts";
import { requireSession } from "./_require.ts";

const Credentials = v.object({
	email:    v.string().email().trim().lowercase(),
	password: v.string().min(8).max(200),
});

export const signup = createMutation({
	description: "Create an account and start a session.",
	input:  Credentials,
	output: UserPublicSchema,
	run: async (opts: { input: v.Infer<typeof Credentials>; ctx: Ctx }) => {
		const existing = opts.ctx.db
			.prepare("SELECT 1 FROM users WHERE email = ?")
			.get(opts.input.email);
		if (existing) throw new RpcError("conflict", "email already in use");

		const user = UserSchema.create({
			email:        opts.input.email,
			passwordHash: hashPassword(opts.input.password),
		});
		opts.ctx.db
			.prepare("INSERT INTO users (_id, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)")
			.run(user._id, user.email, user.passwordHash, user.createdAt);

		issueSession(user._id, opts.ctx.db, opts.ctx.setCookie);
		return UserPublicSchema.parse(user);
	},
});

export const login = createMutation({
	description: "Sign in and start a session.",
	input:  Credentials,
	output: UserPublicSchema,
	run: async (opts: { input: v.Infer<typeof Credentials>; ctx: Ctx }) => {
		const user = opts.ctx.db
			.prepare("SELECT * FROM users WHERE email = ?")
			.get(opts.input.email) as v.Infer<typeof UserSchema> | undefined;
		if (!user || !verifyPassword(opts.input.password, user.passwordHash)) {
			throw new RpcError("unauthorized", "invalid email or password");
		}
		issueSession(user._id, opts.ctx.db, opts.ctx.setCookie);
		return UserPublicSchema.parse(user);
	},
});

export const logout = createMutation({
	description: "Clear the current session.",
	input: v.object({}),
	run: async (opts: { input: {}; ctx: Ctx }) => {
		if (opts.ctx.session) {
			clearSession(opts.ctx.session.token, opts.ctx.db, opts.ctx.setCookie);
		}
	},
});

export const me = createQuery({
	description: "Return the current authenticated user, or null.",
	input:  v.object({}),
	output: UserPublicSchema.nullable(),
	run: async (opts: { input: {}; ctx: Ctx }) => {
		if (!opts.ctx.session) return null;
		const user = opts.ctx.db
			.prepare("SELECT * FROM users WHERE _id = ?")
			.get(opts.ctx.session.userId) as v.Infer<typeof UserSchema> | undefined;
		return user ? UserPublicSchema.parse(user) : null;
	},
});

function hashPassword(plain: string): string {
	const salt = randomBytes(16);
	const hash = scryptSync(plain, salt, 64);
	return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(plain: string, encoded: string): boolean {
	const [scheme, saltHex, hashHex] = encoded.split("$");
	if (scheme !== "scrypt") return false;
	const salt   = Buffer.from(saltHex, "hex");
	const expected = Buffer.from(hashHex, "hex");
	const actual   = scryptSync(plain, salt, expected.length);
	return timingSafeEqual(actual, expected);
}
```

Things worth noticing:

- `requireSession` is imported but only used by feature-specific
  actions; the auth actions themselves don't require a prior session
  (you can't be logged in to log in).
- Returned `UserPublic` strips `passwordHash` via `UserSchema.omit`.
  The schema enforces it; we never trust ourselves to "remember not to
  return the hash."
- `RpcError` is the standard way to signal a categorized failure to
  the client. Categories like `unauthorized` and `conflict` map to
  the right HTTP status codes automatically.

## Step 6 — the notes

```ts
// features/notes/note.ts
import { v } from "@vyn/core";
import { uuid } from "@vyn/core/util";

export const NoteSchema = v.object({
	_id:       v.string().uuid().default(() => uuid()),
	userId:    v.string().uuid(),
	title:     v.string().min(1).max(280).default("Untitled"),
	body:      v.string().default(""),
	createdAt: v.number().default(() => Date.now()),
	updatedAt: v.number().default(() => Date.now()),
});

export type Note = v.Infer<typeof NoteSchema>;
```

```ts
// features/notes/notes.actions.ts
import { createQuery, createMutation, createSubscription, v, RpcError } from "@vyn/core";
import type { Ctx } from "../../_ctx.ts";
import { NoteSchema, type Note } from "./note.ts";
import { requireSession } from "../auth/_require.ts";

export const list = createQuery({
	description: "List the current user's notes, newest first.",
	input:  v.object({}),
	output: v.array(NoteSchema),
	run: async (opts: { input: {}; ctx: Ctx }) => {
		const session = requireSession(opts);
		return opts.ctx.db
			.prepare("SELECT * FROM notes WHERE userId = ? ORDER BY updatedAt DESC")
			.all(session.userId) as Note[];
	},
});

export const get = createQuery({
	description: "Get a single note by id.",
	input:  v.object({ _id: v.string().uuid() }),
	output: NoteSchema,
	run: async (opts: { input: { _id: string }; ctx: Ctx }) => {
		const session = requireSession(opts);
		const note = opts.ctx.db
			.prepare("SELECT * FROM notes WHERE _id = ? AND userId = ?")
			.get(opts.input._id, session.userId) as Note | undefined;
		if (!note) throw new RpcError("not_found", "no such note");
		return note;
	},
});

export const onChanged = createSubscription({
	description: "Stream changes to the current user's notes.",
	input: v.object({}),
	output: v.object({
		kind: v.string(),     // "added" | "updated" | "removed"
		note: NoteSchema,
	}),
	run: async function* (opts: { input: {}; ctx: Ctx; events: AsyncIterable<{ kind: string; note: Note }>; signal: AbortSignal }) {
		requireSession(opts);
		for await (const event of opts.events) {
			if (event.note.userId === opts.ctx.session.userId) yield event;
		}
	},
});

export const create = createMutation({
	description: "Create a note for the current user.",
	input:  NoteSchema.pick(["title", "body"]).partial(),
	output: NoteSchema,
	tool: {},
	run: async (opts: { input: { title?: string; body?: string }; ctx: Ctx }) => {
		const session = requireSession(opts);
		const note = NoteSchema.create({ ...opts.input, userId: session.userId });
		opts.ctx.db
			.prepare("INSERT INTO notes (_id, userId, title, body, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
			.run(note._id, note.userId, note.title, note.body, note.createdAt, note.updatedAt);
		onChanged.emit({ kind: "added", note });
		return note;
	},
});

export const update = createMutation({
	description: "Update a note's title and/or body.",
	input: v.object({
		_id:   v.string().uuid(),
		title: v.string().min(1).max(280).optional(),
		body:  v.string().optional(),
	}),
	output: NoteSchema,
	tool: {},
	run: async (opts: { input: { _id: string; title?: string; body?: string }; ctx: Ctx }) => {
		const session = requireSession(opts);
		const existing = opts.ctx.db
			.prepare("SELECT * FROM notes WHERE _id = ? AND userId = ?")
			.get(opts.input._id, session.userId) as Note | undefined;
		if (!existing) throw new RpcError("not_found", "no such note");

		const updated = NoteSchema.update(existing, {
			...(opts.input.title !== undefined && { title: opts.input.title }),
			...(opts.input.body  !== undefined && { body:  opts.input.body  }),
			updatedAt: Date.now(),
		});
		opts.ctx.db
			.prepare("UPDATE notes SET title = ?, body = ?, updatedAt = ? WHERE _id = ?")
			.run(updated.title, updated.body, updated.updatedAt, updated._id);
		onChanged.emit({ kind: "updated", note: updated });
		return updated;
	},
});

export const remove = createMutation({
	description: "Delete a note.",
	input:  v.object({ _id: v.string().uuid() }),
	tool: {},
	run: async (opts: { input: { _id: string }; ctx: Ctx }) => {
		const session = requireSession(opts);
		const existing = opts.ctx.db
			.prepare("SELECT * FROM notes WHERE _id = ? AND userId = ?")
			.get(opts.input._id, session.userId) as Note | undefined;
		if (!existing) throw new RpcError("not_found", "no such note");
		opts.ctx.db.prepare("DELETE FROM notes WHERE _id = ?").run(opts.input._id);
		onChanged.emit({ kind: "removed", note: existing });
	},
});
```

Notice:

- Every note action calls `requireSession(opts)` first. Two lines per
  action; explicit, no magic.
- Every query scopes by `userId`. No cross-tenant data leakage by
  default.
- `onChanged.run` filters events by the *receiver's* session — only
  the owner sees events for their notes, even though every mutation
  emits to the same channel. The `requireSession` check runs once on
  connect; the `for await` loop then yields only events whose
  `note.userId` matches the subscriber's user.

## Step 7 — server boot

```ts
// server.ts
import { serve } from "@vyn/server";
import { env } from "./env.ts";
import { openDb } from "./_db.ts";
import { readSession } from "./features/auth/_session.ts";
import "./_vyn.gen.ts";

serve({
	port: Number(env.PORT),

	staticContext: async () => {
		const db = openDb();
		return { db };
	},

	createContext: async ({ req, staticCtx }) => {
		const session = readSession(req, staticCtx.db);
		return { session };
	},

	mcp: true,   // expose notes.create/update/remove to MCP clients
});

console.log(`listening on http://localhost:${env.PORT}`);
```

Static ctx opens the database and applies migrations once. Dynamic ctx
reads the session per request. Both feed every action's `opts.ctx`.

## Step 8 — components

A reusable `<auth-form>` that the login and signup routes both reuse:

```ts
// features/auth/auth-form.component.ts
import { component, signal, html } from "@vyn/client";

export default component<{ mode: "login" | "signup"; error?: string }>(({ mode, error, emit }) => {
	const email    = signal("");
	const password = signal("");
	const verb     = mode === "login" ? "Sign in" : "Sign up";

	return html`
		<form @submit=${(e: SubmitEvent) => {
			e.preventDefault();
			emit("submit", { email: email(), password: password() });
		}}>
			<h1>${verb}</h1>
			${error ? html`<p class="error">${error}</p>` : null}
			<label>Email <input type="email" required @input=${(e: Event) => email.set((e.target as HTMLInputElement).value)} /></label>
			<label>Password <input type="password" required minlength="8" @input=${(e: Event) => password.set((e.target as HTMLInputElement).value)} /></label>
			<button type="submit">${verb}</button>
		</form>
	`;
});
```

A `<note-card>` for the list view:

```ts
// features/notes/note-card.component.ts
import { component, html } from "@vyn/client";
import type { Note } from "./note.ts";

export default component<{ note: Note }>(({ note, emit }) => html`
	<li>
		<a href="/notes/${note._id}/">
			<h3>${note.title}</h3>
			<p>${note.body.slice(0, 120)}${note.body.length > 120 ? "…" : ""}</p>
			<small>updated ${new Date(note.updatedAt).toLocaleString()}</small>
		</a>
		<button @click=${() => emit("remove", note)}>×</button>
	</li>
`);
```

## Step 9 — the routes

The SPA shell stays the same as in the todo tutorial. The four routes
below are what's new.

```html
<!-- public/routes/index.html -->
<header>
	<h1>Notes</h1>
	<button id="new">+ new</button>
	<button id="logout">log out</button>
</header>
<ul id="list"></ul>
```

```ts
// public/routes/index.ts
import { createApp, $, html, render } from "@vyn/client";
import type { AppRouter } from "../../_vyn.gen.ts";
import type { Note } from "../../features/notes/note.ts";

const { rpc, cache } = createApp<AppRouter>();

// Require auth at route entry; redirect to /login if missing.
const user = await rpc.me.query({});
if (!user) { location.href = "/login/"; throw new Error("unauthenticated"); }

const listEl   = $<HTMLUListElement>("#list");
const newBtn   = $<HTMLButtonElement>("#new");
const logoutEl = $<HTMLButtonElement>("#logout");

function paint(notes: Note[]) {
	render(listEl, notes.map(n => html`
		<note-card
			.note=${n}
			@remove=${(e: CustomEvent<Note>) => rpc.notes.remove.mutate({ _id: e.detail._id })}
		></note-card>
	`));
}

rpc.notes.onChanged.listen({}, {
	onValue: event => {
		cache.patch(rpc.notes.list, list => {
			switch (event.kind) {
				case "added":   return [event.note, ...list];
				case "updated": return list.map(n => n._id === event.note._id ? event.note : n);
				case "removed": return list.filter(n => n._id !== event.note._id);
			}
		});
	},
});

cache.subscribe(rpc.notes.list, paint);

newBtn.addEventListener("click", async () => {
	const note = await rpc.notes.create.mutate({});
	location.href = `/notes/${note._id}/`;
});

logoutEl.addEventListener("click", async () => {
	await rpc.logout.mutate({});
	location.href = "/login/";
});

void rpc.notes.list.query({});
```

```html
<!-- public/routes/login.html -->
<auth-form id="form" mode="login"></auth-form>
```

```ts
// public/routes/login.ts
import { createApp, $, html } from "@vyn/client";
import type { AppRouter } from "../../_vyn.gen.ts";

const { rpc } = createApp<AppRouter>();
const form = $<HTMLElement & { mode: string; error?: string }>("#form");

form.addEventListener("submit", async (e: any) => {
	try {
		await rpc.login.mutate(e.detail);
		location.href = "/";
	} catch (err: any) {
		form.error = err.message;
	}
});
```

```html
<!-- public/routes/signup.html -->
<auth-form id="form" mode="signup"></auth-form>
```

```ts
// public/routes/signup.ts
import { createApp, $ } from "@vyn/client";
import type { AppRouter } from "../../_vyn.gen.ts";

const { rpc } = createApp<AppRouter>();
const form = $<HTMLElement & { mode: string; error?: string }>("#form");

form.addEventListener("submit", async (e: any) => {
	try {
		await rpc.signup.mutate(e.detail);
		location.href = "/";
	} catch (err: any) {
		form.error = err.message;
	}
});
```

```html
<!-- public/routes/notes/[noteId].html -->
<a href="/">← back</a>
<input id="title" />
<textarea id="body" rows="20"></textarea>
```

```ts
// public/routes/notes/[noteId].ts
import { createApp, $, useParams } from "@vyn/client";
import type { AppRouter } from "../../../_vyn.gen.ts";

const { rpc } = createApp<AppRouter>();
const { noteId } = useParams("/notes/:noteId/");

const titleEl = $<HTMLInputElement>("#title");
const bodyEl  = $<HTMLTextAreaElement>("#body");

const note = await rpc.notes.get.query({ _id: noteId });
titleEl.value = note.title;
bodyEl.value  = note.body;

// Save on blur or every keystroke (debounced); minimal version: on blur.
async function save() {
	await rpc.notes.update.mutate({
		_id:   noteId,
		title: titleEl.value,
		body:  bodyEl.value,
	});
}
titleEl.addEventListener("blur", save);
bodyEl.addEventListener("blur", save);
```

## Step 10 — try it

```sh
vyn dev
```

Open `http://localhost:8000/signup/`, create an account, write a note,
sign out, sign back in. Open a second browser (or incognito window),
sign up as a different user, write a note — confirm each account only
sees its own list. Open two tabs as the same user and watch realtime
updates flow as you add or edit.

## Step 11 — talk to it from an LLM

`create`, `update`, and `remove` declared `tool: {}`, so they're
exposed at `http://localhost:8000/mcp`. Point an MCP client at that
URL (with the user's session cookie attached) and the LLM can manage
that user's notes — same per-user scoping, since the same `requireSession`
runs no matter the surface.

## Next steps

- **Search.** Add `notes.search` as a query taking a string input and
  using SQLite's FTS5. Same per-user scoping pattern.
- **Sharing.** Add a `shared_with` join table; relax the per-user
  filter in `list` and `get` to include shared notes.
- **Optimistic mutations.** Wire `useMutation` with an `onMutate` cache
  patch so titles update instantly while the network call finishes.
- **Forms from models.** Generate the auth form from `UserSchema.pick(["email", "passwordHash"])`
  using the generated-forms surface (coming).

## See also

- [Configuration](/guide/configuration/) — env validation and three-layer ctx
- [Actions](/guide/actions/) — the registry and the three primitives
- [Models](/guide/models/) — schemas, defaults, derivations
- [Components](/guide/components/) — the render-function flavor used here
- [Realtime](/guide/realtime/) — `onChanged.emit` + client-side patches

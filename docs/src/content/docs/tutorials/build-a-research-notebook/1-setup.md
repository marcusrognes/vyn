---
title: 1 · Setup
description: Project scaffold, MongoDB driver, env schema, SuperJSON wire transformer, and Tailwind integration.
sidebar:
  order: 1
---

We'll get the foundation in place: scaffold the project, install
the few dependencies the tutorial needs, declare typed env, open a
MongoDB connection in `staticContext`, configure SuperJSON as the
wire transformer, and wire Tailwind into the SPA shell.

## Scaffold

```sh
deno create npm:vyn notebook
cd notebook
deno add npm:mongodb npm:superjson npm:@anthropic-ai/sdk
deno add npm:tailwindcss npm:@tailwindcss/postcss
```

The scaffolder produced a hello-world app. Strip the example feature
and start from a clean slate:

```sh
rm -rf features/hello public/routes/index.*
```

## Project layout

```
notebook/                              project root
├── vyn.config.ts                      actionsRoot: "features"
├── env.ts                             typed env
├── transform.ts                       SuperJSON wire transformer
├── db.ts                              MongoDB client + collection helpers
├── ctx.ts                             Ctx type for the app
├── server.ts                          boot
├── features/                          (filled in over the next pages)
│   ├── notes/
│   ├── auth/
│   └── agent/
└── public/
    ├── index.html                     SPA shell
    ├── style.css                      Tailwind entry
    └── routes/
        └── index.html                 the main page (built in step 5)
```

## env.ts

```ts
// env.ts
import { v } from "@vynjs/core";

export const env = v.object({
	MONGO_URL:        v.string().url().default("mongodb://localhost:27017"),
	MONGO_DB:         v.string().default("notebook"),
	SESSION_SECRET:   v.string().min(32),
	PORT:             v.string().regex(/^\d+$/).default("8000"),
	NODE_ENV:         v.string().regex(/^(development|production|test)$/).default("development"),
	ANTHROPIC_API_KEY: v.string(),
}).parse(Deno.env.toObject());
```

Create `.env`:

```
SESSION_SECRET=<openssl rand -hex 32>
ANTHROPIC_API_KEY=sk-ant-...
```

## SuperJSON transformer

SuperJSON is the canonical implementation of the transformer
contract Vyn expects (`{ serialize, deserialize }`). Wrap it in a
shared module so client and server agree:

```ts
// transform.ts
import superjson from "superjson";
import type { Transformer } from "@vynjs/server";

export const transformer: Transformer = {
	serialize:   (value) => superjson.serialize(value),
	deserialize: (s)     => superjson.deserialize(s),
};
```

We'll import this from `server.ts` and from the client entry — both
sides must use the same instance for the wire to round-trip.

## MongoDB driver

```ts
// db.ts
import { MongoClient, type Db, type Collection } from "mongodb";
import { env } from "./env.ts";

export type AppDb = {
	client: MongoClient;
	db:     Db;
	notes:        Collection<NoteDoc>;
	users:        Collection<UserDoc>;
	sessions:     Collection<SessionDoc>;
	researchRuns: Collection<ResearchRunDoc>;
};

export type NoteDoc        = { _id: string; userId: string; title: string; body: string; tags: string[]; createdAt: Date; updatedAt: Date };
export type UserDoc        = { _id: string; email: string; passwordHash: string; preferences?: Record<string, unknown>; createdAt: Date };
export type SessionDoc     = { token: string; userId: string; expiresAt: Date };
export type ResearchRunDoc = { _id: string; userId: string; topic: string; status: "queued" | "running" | "completed" | "failed"; result?: { summary: string; citations: string[]; events: unknown[] }; createdAt: Date; completedAt?: Date };

export async function openDb(): Promise<AppDb> {
	const client = new MongoClient(env.MONGO_URL);
	await client.connect();
	const db = client.db(env.MONGO_DB);

	const notes        = db.collection<NoteDoc>("notes");
	const users        = db.collection<UserDoc>("users");
	const sessions     = db.collection<SessionDoc>("sessions");
	const researchRuns = db.collection<ResearchRunDoc>("researchRuns");

	await Promise.all([
		users.createIndex({ email: 1 }, { unique: true }),
		sessions.createIndex({ token: 1 }, { unique: true }),
		sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
		notes.createIndex({ userId: 1, updatedAt: -1 }),
		notes.createIndex({ tags: 1 }),
		notes.createIndex({ title: "text", body: "text" }),
		researchRuns.createIndex({ userId: 1, createdAt: -1 }),
	]);

	return { client, db, notes, users, sessions, researchRuns };
}
```

The `expireAfterSeconds: 0` index on `sessions.expiresAt` lets
MongoDB auto-evict expired sessions. The text index on
`notes.{title,body}` powers the search action in the next page.

## ctx.ts

```ts
// ctx.ts
import type { BaseCtx } from "@vynjs/server";
import type { AppDb } from "./db.ts";

export type StaticCtx  = { db: AppDb };
export type DynamicCtx = { userId: string | null };
export type Ctx        = BaseCtx & StaticCtx & DynamicCtx;
```

We'll wire up auth in the next page; the dynamic ctx carries just
`userId` for now. Sessions live in MongoDB.

## server.ts

```ts
// server.ts
import { serve } from "@vynjs/server";
import { env } from "./env.ts";
import { openDb } from "./db.ts";
import { transformer } from "./transform.ts";
import "./_vyn.gen.ts";

serve({
	port:        Number(env.PORT),
	transformer,

	staticContext: async () => {
		const db = await openDb();
		return { db };
	},

	createContext: async ({ req, staticCtx }) => {
		const token = parseSessionCookie(req);
		if (!token) return { userId: null };
		const session = await staticCtx.db.sessions.findOne({ token });
		return { userId: session?.userId ?? null };
	},

	mcp: true,
});

function parseSessionCookie(req: Request): string | undefined {
	const header = req.headers.get("cookie") ?? "";
	for (const part of header.split(/;\s*/)) {
		const [k, v] = part.split("=");
		if (k === "session") return decodeURIComponent(v ?? "");
	}
}
```

The `staticContext` opens the MongoDB connection once at boot. The
`createContext` looks up the session per request — cheap because of
the `token` unique index.

## Tailwind

Wire Tailwind into the build. The scaffolder produced a `style.css`
that imports basic resets; replace it with a Tailwind entry:

```css
/* public/style.css */
@import "tailwindcss";

/* App-specific tokens; Tailwind composes around these */
:root {
	--vyn-focus-ring:   2px solid theme("colors.indigo.500");
	--vyn-focus-offset: 2px;
}

@layer components {
	.btn {
		@apply px-3 py-1.5 rounded-md font-medium transition;
	}
	.btn-primary {
		@apply btn bg-indigo-600 text-white hover:bg-indigo-500;
	}
	.btn-ghost {
		@apply btn text-slate-600 hover:bg-slate-100;
	}
}
```

Configure PostCSS to run Tailwind v4:

```ts
// postcss.config.mjs
import tailwindcss from "@tailwindcss/postcss";
export default { plugins: [tailwindcss()] };
```

`vyn build` and `vyn dev` pick up the PostCSS config automatically;
Tailwind classes used in route templates and component renders are
scanned at build time.

## Try it

```sh
vyn dev
```

Open `http://localhost:8000`. You'll see the SPA shell with no route
content yet — that's expected; we'll add routes as features land.
The dev server should boot without errors, which proves env parses,
MongoDB connects, and the transformer wires up.

If the MongoDB connection fails, check `MONGO_URL` and that the
`mongo` container (or whatever you're running) actually listens on
27017.

## Where you are

You have:

- A typed env that fails boot on missing required vars
- A MongoDB connection opened once and shared via `staticContext`
- SuperJSON configured as the wire transformer (so Date / Map / Set
  / BigInt round-trip cleanly in the coming actions)
- Tailwind ready to style the UI

Continue to **[2 · Notes](../2-notes/)** to build the basic note
feature: model, CRUD actions, search, realtime.

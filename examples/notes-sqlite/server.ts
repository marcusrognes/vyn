import { serve } from "@vyn/server";
import { createMemorySessionStore } from "@vyn/auth";
import { openSqlite } from "@vyn/db-sqlite";
import "./_vyn.gen.ts";
import type { Note } from "./features/notes/note.ts";
import type { User } from "./ctx.ts";

const db       = openSqlite(process.env.DB_PATH ?? "./notes.db");
const users    = db.collection<User>("users");
const notes    = db.collection<Note>("notes");
const sessions = createMemorySessionStore();

serve({
	port: Number(process.env.PORT ?? 8000),

	staticContext: async () => ({ users, notes, sessions }),

	createContext: async ({ req }) => {
		const cookieHeader = req.headers.get("cookie") ?? "";
		const token = parseToken(cookieHeader);
		if (!token) return { userId: null };
		const session = await sessions.get(token);
		return { userId: session?.userId ?? null };
	},
});

function parseToken(cookieHeader: string): string | undefined {
	for (const part of cookieHeader.split(/;\s*/)) {
		const [k, v] = part.split("=");
		if (k === "session") return decodeURIComponent(v ?? "");
	}
}

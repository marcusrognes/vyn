import { serve } from "@vyn/server";
import { createMemorySessionStore } from "@vyn/auth";
import "./_vyn.gen.ts";
import type { Note } from "./features/notes/note.ts";
import type { User } from "./ctx.ts";

const sessions = createMemorySessionStore();

serve({
	port: Number(process.env.PORT ?? 8000),

	staticContext: async () => ({
		users:    new Map<string, User>(),
		notes:    new Map<string, Note>(),
		sessions,
	}),

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

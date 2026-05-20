import { serve } from "@vyn/server";
import { transformer } from "./transform.ts";
import "./_vyn.gen.ts";
import type { Note, ResearchRun } from "./ctx.ts";

serve({
	port: Number(process.env.PORT ?? 8000),
	transformer,
	staticContext: async () => ({
		notes:    new Map<string, Note>(),
		research: new Map<string, ResearchRun>(),
	}),
});

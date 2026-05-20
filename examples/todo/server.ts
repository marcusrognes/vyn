import { serve } from "@vyn/server";
import "./_vyn.gen.ts";
import type { Todo } from "./features/todos/todo.ts";

serve({
	port: Number(process.env.PORT ?? 8000),
	staticContext: async () => ({ todos: new Map<string, Todo>() }),
	mcp: true,
});

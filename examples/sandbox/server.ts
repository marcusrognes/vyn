import { serve } from "@vynjs/server";
import "./_vyn.gen.ts";

await serve({
	port: Number(Deno.env.get("PORT") ?? 8000),
});

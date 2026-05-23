import { createQuery, v } from "@vynjs/core";

export const greet = createQuery({
	name:        "hello.greet",
	description: "Say hello to someone.",
	input:       v.object({ name: v.string().default("world") }),
	output:      v.string(),
	run:         async ({ input }) => `Hello, ${input.name}!`,
});

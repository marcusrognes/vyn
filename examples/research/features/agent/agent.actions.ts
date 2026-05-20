// Streaming agent mutation — uses opts.tick to surface tool calls,
// status, and token deltas to the caller via SSE. The 'LLM' is a
// fake stub that emits realistic-looking events with delays so the
// streaming surface is testable without an API key.

import { createMutation, v } from "@vyn/core";
import type { Ctx } from "../../ctx.ts";

const Tick = v.union(
	v.object({ kind: v.literal("status"),      message: v.string(), progress: v.number().optional() }),
	v.object({ kind: v.literal("tool_call"),   tool: v.string(), input: v.unknown() }),
	v.object({ kind: v.literal("tool_result"), tool: v.string(), output: v.unknown() }),
	v.object({ kind: v.literal("text_delta"),  text: v.string() }),
);

export const ask = createMutation({
	name:        "agent.ask",
	description: "Answer a question with tool use; streams progress via opts.tick.",
	input:       v.object({ question: v.string().min(1).max(2000) }),
	output:      v.object({ answer: v.string(), citations: v.array(v.string()) }),
	progress:    Tick,
	tool:        {},
	run: async (opts) => {
		const tick = opts.tick!;
		const question = opts.input.question;

		tick({ kind: "status", message: "Searching notes…", progress: 0.1 });
		await sleep(150);
		tick({ kind: "tool_call", tool: "searchNotes", input: { query: question } });
		await sleep(100);
		tick({ kind: "tool_result", tool: "searchNotes", output: { count: 0 } });

		tick({ kind: "status", message: "Generating answer…", progress: 0.5 });
		const answer = `Pretend answer to: ${question}. (The agent is mocked in this example; wire a real LLM client to make it real.)`;
		for (const word of answer.split(" ")) {
			tick({ kind: "text_delta", text: word + " " });
			await sleep(20);
		}

		tick({ kind: "status", message: "Done", progress: 1 });
		return { answer: answer.trim(), citations: ["https://example.com/source-1"] };
	},
});

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

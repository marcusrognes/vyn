// Streaming agent mutation. If ANTHROPIC_API_KEY is set, calls Claude
// via the streaming SDK; otherwise falls back to a deterministic
// mock so the example runs out of the box.

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

		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (apiKey) return runRealAgent(question, tick, apiKey);
		return runMockAgent(question, tick);
	},
});

async function runRealAgent(question: string, tick: (e: unknown) => void, apiKey: string) {
	tick({ kind: "status", message: "Calling Claude…", progress: 0.1 });

	const res = await fetch("https://api.anthropic.com/v1/messages", {
		method:  "POST",
		headers: {
			"x-api-key":          apiKey,
			"anthropic-version":  "2023-06-01",
			"content-type":       "application/json",
		},
		body: JSON.stringify({
			model:       "claude-opus-4-7",
			max_tokens:  1024,
			stream:      true,
			messages:    [{ role: "user", content: question }],
		}),
	});

	if (!res.ok || !res.body) throw new Error(`anthropic API error: ${res.status}`);

	const reader  = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let answer = "";

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let idx;
		while ((idx = buffer.indexOf("\n\n")) >= 0) {
			const event = buffer.slice(0, idx);
			buffer      = buffer.slice(idx + 2);
			const lines = event.split("\n");
			let data = "";
			for (const ln of lines) {
				if (ln.startsWith("data: ")) data += ln.slice(6);
			}
			if (!data) continue;
			try {
				const payload = JSON.parse(data);
				if (payload.type === "content_block_delta" && payload.delta?.type === "text_delta") {
					const text = payload.delta.text as string;
					answer += text;
					tick({ kind: "text_delta", text });
				}
			} catch { /* ignore parse errors on partial frames */ }
		}
	}

	tick({ kind: "status", message: "Done", progress: 1 });
	return { answer: answer.trim() || "(empty response)", citations: [] };
}

async function runMockAgent(question: string, tick: (e: unknown) => void) {
	tick({ kind: "status", message: "Searching notes…", progress: 0.1 });
	await sleep(150);
	tick({ kind: "tool_call", tool: "searchNotes", input: { query: question } });
	await sleep(100);
	tick({ kind: "tool_result", tool: "searchNotes", output: { count: 0 } });

	tick({ kind: "status", message: "Generating answer…", progress: 0.5 });
	const answer = `Pretend answer to: ${question}. (No ANTHROPIC_API_KEY set — set one to use the real model.)`;
	for (const word of answer.split(" ")) {
		tick({ kind: "text_delta", text: word + " " });
		await sleep(20);
	}

	tick({ kind: "status", message: "Done", progress: 1 });
	return { answer: answer.trim(), citations: ["https://example.com/source-1"] };
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

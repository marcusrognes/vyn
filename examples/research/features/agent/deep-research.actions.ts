import { createJob, createMutation, createNotification, createSubscription, v } from "@vyn/core";
import type { Ctx, ResearchRun } from "../../ctx.ts";

// The in-app channel ships its rows through this subscription so the
// browser can show live badge updates without polling.
export const onNotification = createSubscription({
	name:        "research.onNotification",
	description: "Stream new inbox rows.",
	input:       v.object({}),
	output:      v.any(),
	run: async function* (opts) {
		for await (const event of opts.events) yield event;
	},
});

export const researchReady = createNotification({
	name:        "research.researchReady",
	description: "A deep research run completed.",
	input:       v.object({
		userId:  v.string(),
		runId:   v.string().uuid(),
		topic:   v.string(),
		summary: v.string(),
	}),
	channels: {
		inApp: async (opts: any) => ({
			notification: "research.researchReady",
			payload: {
				kind:    "research_ready",
				runId:   opts.input.runId,
				topic:   opts.input.topic,
				summary: opts.input.summary,
				title:   `Research ready: ${opts.input.topic}`,
				body:    opts.input.summary,
			},
		}),
	},
});

export const deepResearch = createJob({
	name:        "research.deepResearch",
	description: "Long-running research investigation.",
	input:       v.object({
		runId:  v.string().uuid(),
		topic:  v.string().min(1).max(500),
		userId: v.string().default(() => "anon"),
	}),
	progress: v.object({ stage: v.string(), pct: v.number() }),
	retries:  1,
	timeout:  60_000,
	run: async (opts: { input: { runId: string; topic: string; userId: string }; ctx: Ctx; tick: (e: any) => void }) => {
		const run = opts.ctx.research.get(opts.input.runId);
		if (!run) throw new Error("run not found");
		run.status = "running";

		opts.tick({ stage: "loading", pct: 0.1 });
		await sleep(200);

		opts.tick({ stage: "researching", pct: 0.5 });
		await sleep(300);

		opts.tick({ stage: "synthesizing", pct: 0.9 });
		await sleep(200);

		const summary = `Deep research summary for: ${opts.input.topic}. (Mocked for the example; wire a real agent loop for production research.)`;
		run.status      = "completed";
		run.completedAt = new Date();
		run.result      = { summary, citations: ["https://example.com/1"] };

		await researchReady.send({
			userId:  opts.input.userId,
			runId:   opts.input.runId,
			topic:   opts.input.topic,
			summary,
		});
	},
});

export const startDeepResearch = createMutation({
	name:        "research.startDeepResearch",
	description: "Kick off a deep research run.",
	input:       v.object({ topic: v.string().min(1).max(500) }),
	output:      v.object({ runId: v.string().uuid(), jobId: v.string() }),
	run: async (opts: { input: { topic: string }; ctx: Ctx }) => {
		const runId: string = crypto.randomUUID();
		const run: ResearchRun = {
			_id:       runId,
			topic:     opts.input.topic,
			status:    "queued",
			createdAt: new Date(),
		};
		opts.ctx.research.set(runId, run);
		const jobId = await deepResearch.now({ runId, topic: opts.input.topic, userId: "anon" });
		run.jobId   = jobId;
		return { runId, jobId };
	},
});

export const getRun = createMutation({
	name:        "research.getRun",
	description: "Fetch a research run by id.",
	input:       v.object({ runId: v.string().uuid() }),
	output:      v.any(),
	run: async (opts: { input: { runId: string }; ctx: Ctx }) => {
		const run = opts.ctx.research.get(opts.input.runId);
		if (!run) return null;
		return run;
	},
});

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

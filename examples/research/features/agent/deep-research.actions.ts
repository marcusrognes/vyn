import { createJob, createMutation, createNotification, v } from "@vyn/core";
import type { Ctx, ResearchRun } from "../../ctx.ts";

export const researchReady = createNotification({
	name:        "research.researchReady",
	description: "A deep research run completed.",
	input:       v.object({
		runId:   v.string().uuid(),
		topic:   v.string(),
		summary: v.string(),
	}),
	channels: {
		inApp: async (opts: any) => ({
			kind:    "research_ready",
			runId:   opts.input.runId,
			topic:   opts.input.topic,
			summary: opts.input.summary,
		}),
	},
});

export const deepResearch = createJob({
	name:        "research.deepResearch",
	description: "Long-running research investigation.",
	input:       v.object({
		runId: v.string().uuid(),
		topic: v.string().min(1).max(500),
	}),
	progress: v.object({ stage: v.string(), pct: v.number() }),
	retries:  1,
	timeout:  60_000,
	run: async (opts: { input: { runId: string; topic: string }; ctx: Ctx; tick: (e: any) => void }) => {
		const run = opts.ctx.research.get(opts.input.runId);
		if (!run) throw new Error("run not found");
		run.status = "running";

		opts.tick({ stage: "loading", pct: 0.1 });
		await sleep(200);

		opts.tick({ stage: "researching", pct: 0.5 });
		await sleep(300);

		opts.tick({ stage: "synthesizing", pct: 0.9 });
		await sleep(200);

		const summary = `Deep research summary for: ${opts.input.topic}`;
		run.status      = "completed";
		run.completedAt = new Date();
		run.result      = { summary, citations: ["https://example.com/1"] };

		await researchReady.send({
			runId:   opts.input.runId,
			topic:   opts.input.topic,
			summary,
		});
	},
});

export const startDeepResearch = createMutation({
	name:        "research.startDeepResearch",
	description: "Kick off a deep research run; returns runId + jobId.",
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
		const jobId = await deepResearch.now({ runId, topic: opts.input.topic });
		return { runId, jobId };
	},
});

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

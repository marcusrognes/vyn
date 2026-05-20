---
title: 4 · Deep research
description: Long-running background research as a job. Notifications fire across push, email digest, and in-app when the work completes — per the user's preferences.
sidebar:
  order: 4
---

The streaming `ask` from the previous page is fine for fast
questions. For deeper investigations — "research the state of X
across these 30 sources, give me a 2000-word report" — that takes
minutes. Two problems:

1. The user shouldn't have to keep the browser tab open.
2. We want to retry the work if it crashes partway.

Both are exactly what jobs are for. We'll add `deepResearch` as a
job, persist the result, and fire a multi-channel notification when
it's done.

## The job

```ts
// features/research/deepResearch.actions.ts
import { createJob, v } from "@vyn/core";
import { createAgent } from "@vyn/agent";
import { uuid } from "@vyn/core/util";
import type { Ctx } from "../../ctx.ts";
import { searchNotes } from "../notes/notes.actions.ts";
import { searchWeb, fetchPage } from "./research.actions.ts";
import { researchReady } from "./researchReady.actions.ts";   // built next
import { env } from "../../env.ts";

const Tick = v.union([
	v.object({ kind: v.literal("status"),      message: v.string(), progress: v.number().optional() }),
	v.object({ kind: v.literal("tool_call"),   tool: v.string(), input: v.unknown() }),
	v.object({ kind: v.literal("tool_result"), tool: v.string(), output: v.unknown() }),
	v.object({ kind: v.literal("text_delta"),  text: v.string() }),
]);

export const deepResearch = createJob({
	description: "Run a multi-pass deep research investigation.",
	input: v.object({
		topic:  v.string().min(1).max(500),
		userId: v.string().uuid(),
		runId:  v.string().uuid().default(() => uuid()),
	}),
	progress: Tick,
	retries:  2,
	timeout:  30 * 60 * 1000,   // 30 minutes — these can be long
	tool:     {},
	run: async (opts: {
		input: { topic: string; userId: string; runId: string };
		ctx:   Ctx;
		tick:  (e: any) => void;
		job:   { id: string; attempt: number; scheduledAt: Date };
	}) => {
		opts.tick({ kind: "status", message: "Starting deep research…", progress: 0 });

		// Persist a tracking record so the UI can show "in progress" without
		// holding a WebSocket open.
		await opts.ctx.db.researchRuns.insertOne({
			_id:       opts.input.runId,
			userId:    opts.input.userId,
			topic:     opts.input.topic,
			status:    "running",
			createdAt: new Date(),
		});

		try {
			const agent = createAgent({
				model:   "claude-opus-4-7",
				apiKey:  env.ANTHROPIC_API_KEY,
				tools:   [searchNotes, searchWeb, fetchPage],
				system:  "You are conducting multi-pass deep research. Search broadly, follow up on cited sources, synthesize a thorough report. Aim for 1500–2500 words. Always cite.",
				maxToolCalls: 30,
				onEvent: (event) => opts.tick(event),
			});

			const result = await agent.run({
				prompt: `Conduct deep research on the following topic. Be thorough.\n\n${opts.input.topic}`,
				ctx:    opts.ctx,
			});

			await opts.ctx.db.researchRuns.updateOne(
				{ _id: opts.input.runId },
				{ $set: {
					status:      "completed",
					completedAt: new Date(),
					result: {
						summary:   result.text,
						citations: result.citations,
						events:    result.events,
					},
				} },
			);

			// Fire the cross-channel notification — instant push + in-app,
			// deferred email so users get notified once, not twice.
			await researchReady.send({
				userId:  opts.input.userId,
				runId:   opts.input.runId,
				topic:   opts.input.topic,
				summary: result.text.slice(0, 240),
			});

			opts.tick({ kind: "status", message: "Done", progress: 1 });

		} catch (error) {
			await opts.ctx.db.researchRuns.updateOne(
				{ _id: opts.input.runId },
				{ $set: { status: "failed", completedAt: new Date() } },
			);
			throw error;   // surfaces to the worker; retry semantics apply
		}
	},
});
```

The shape is the same `agent.run(...)` loop as the live mutation —
just longer-lived, with persistence on either side. The `tick`
events flow into `opts.tick` so any consumer using
`deepResearch.watch(jobId)` can follow along live.

## Kicking it off

The mutation that schedules deep research is small:

```ts
// features/research/research.actions.ts (additions)
import { createMutation, v } from "@vyn/core";
import { deepResearch } from "./deepResearch.actions.ts";
import type { Ctx } from "../../ctx.ts";
import { requireSession } from "../auth/guards.ts";

export const startDeepResearch = createMutation({
	description: "Start a deep research run; returns a runId you can watch.",
	input:  v.object({ topic: v.string().min(1).max(500) }),
	output: v.object({ runId: v.string().uuid(), jobId: v.string() }),
	run: async (opts: { input: { topic: string }; ctx: Ctx }) => {
		const session = requireSession(opts);
		const runId   = crypto.randomUUID();
		const jobId   = await deepResearch.now({
			topic:  opts.input.topic,
			userId: session.userId,
			runId,
		});
		return { runId, jobId };
	},
});
```

Client side:

```ts
const { runId, jobId } = await rpc.research.startDeepResearch.mutate({ topic: question });

// Optionally tail the job for live progress
for await (const event of rpc.jobs.watch.iterate({ jobId })) {
	if (event.kind === "tick" && event.payload.kind === "status") updateProgress(event.payload);
	if (event.kind === "result") notifyDone();
}
```

The job tailing uses the framework's built-in `jobs.watch`
subscription — `@vyn/core` exposes it because every job needs the
same shape; we don't have to write a separate subscription per job.

## The notification

Multi-channel: instant push, deferred email (so the email isn't
sent if the user is already on the page), in-app for every connected
tab.

```ts
// features/research/researchReady.actions.ts
import { createNotification, v } from "@vyn/core";
import type { Ctx } from "../../ctx.ts";

export const researchReady = createNotification({
	description: "A deep research run finished. Sent across the user's preferred channels.",
	input: v.object({
		userId:  v.string().uuid(),
		runId:   v.string().uuid(),
		topic:   v.string(),
		summary: v.string(),
	}),

	channels: {
		push: {
			mode: "instant",
			render: async (opts: any) => ({
				title: "Research ready",
				body:  opts.input.summary,
				data:  { runId: opts.input.runId },
			}),
		},

		inApp: {
			mode: "instant",
			render: async (opts: any) => ({
				kind:    "research_ready",
				runId:   opts.input.runId,
				topic:   opts.input.topic,
				summary: opts.input.summary,
			}),
		},

		email: {
			mode:         "digest",
			digestKey:    (input: any) => input.userId,
			digestSchedule: { cron: "0 8 * * *" },          // 08:00 daily
			digestMaxAge:   "24h",
			renderItem:   async (opts: any) => ({
				runId:   opts.input.runId,
				topic:   opts.input.topic,
				summary: opts.input.summary,
			}),
			renderDigest: async ({ items, ctx, userId }: any) => {
				const user = await ctx.db.users.findOne({ _id: userId });
				return {
					to:      user!.email,
					subject: `${items.length} research run${items.length === 1 ? "" : "s"} ready`,
					html:    `<h1>Research summary</h1>` + items.map((i: any) =>
						`<section style="margin-bottom:1.5rem">
							<h2><a href="https://notebook.example/research/${i.runId}">${i.topic}</a></h2>
							<p>${i.summary}</p>
						</section>`,
					).join(""),
				};
			},
		},
	},

	retries: 3,
});
```

Per user, **push and in-app fire instantly**, **email batches up
across the day and arrives at 8am** (or whenever the digest
schedule says) with a list of every completed run.

A user reading the page when a run finishes:

1. Sees the in-app notification land (subscription via @vyn/notify
   adapter)
2. Probably doesn't need the email — the user has already seen the
   result
3. The 8am digest is the cleanup: only runs the user *hasn't* read
   stay in the queue (an unread-tracking refinement we'll leave as
   an exercise)

A user offline when a run finishes:

1. Push pings their phone immediately
2. They open the app, see the result, mark as read
3. The digest at 8am skips items they read

## Per-user preferences

A user who hates push notifications:

```ts
// features/auth/preferences.actions.ts
import { createMutation, v } from "@vyn/core";
import type { Ctx } from "../../ctx.ts";
import { requireSession } from "./guards.ts";

export const setPreferences = createMutation({
	description: "Update notification preferences for the current user.",
	input: v.object({
		push:  v.boolean().optional(),
		email: v.object({ enabled: v.boolean(), mode: v.string() }).optional(),
		inApp: v.boolean().optional(),
	}),
	output: v.object({}),
	run: async (opts) => {
		const session = requireSession(opts);
		await opts.ctx.db.users.updateOne(
			{ _id: session.userId },
			{ $set: { preferences: opts.input } },
		);
		return {};
	},
});
```

Wire the preferences resolver in `serve()`:

```ts
serve({
	// ...
	notify: {
		push:  webPushAdapter({ ... }),
		email: postmarkAdapter({ ... }),
		inApp: { subscription: onNotification },

		preferences: async (userId, ctx) => {
			const user = await ctx.db.users.findOne({ _id: userId });
			const prefs = user?.preferences ?? {};
			return {
				push:  { enabled: prefs.push  !== false,                                   mode: "instant" },
				email: { enabled: prefs.email?.enabled !== false, mode: prefs.email?.mode ?? "digest" },
				inApp: { enabled: prefs.inApp !== false,                                  mode: "instant" },
			};
		},
	},
});
```

The framework calls this for every `notification.send()`. If a user
has `push: false` and `email: { enabled: true, mode: "instant" }`,
their push render runs but the adapter is skipped, and their email
goes immediately instead of joining the digest.

## Worker

For multi-minute jobs, run the worker as a separate process so
HTTP latency doesn't share resources:

```sh
# Process 1: HTTP server
vyn dev

# Process 2: worker
vyn worker --concurrency=2
```

Both share the same code base, the same MongoDB, the same job
store. The worker pulls jobs whose `runAt` has passed, runs them
with the full ctx, and publishes ticks back through the bus so any
client watching the job sees them.

In production, scale the worker horizontally (more processes /
pods) while keeping HTTP separate. Workers don't bind ports.

## Where you are

You have:

- Long-running deep research as a `createJob` with retries and
  timeout
- Persistence of run state in MongoDB (`researchRuns` collection)
- A typed mutation to kick off runs and get a `runId`
- `jobs.watch.iterate` from any client to follow the run live
- A `createNotification` that fires instantly via push + in-app and
  joins a daily email digest
- A preferences resolver that flips channel modes per user

Continue to **[5 · UI](../5-ui/)** to build the Tailwind-styled
reader, the live agent viewer, and the dashboard.

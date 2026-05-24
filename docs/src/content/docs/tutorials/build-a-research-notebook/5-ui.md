---
title: 5 · UI
description: Tailwind-styled reader, live agent run viewer, dashboard. Plain HTML plus a few render-function components.
sidebar:
    order: 5
---

The features are wired up. Time to make them usable. We'll use Tailwind utility classes directly in route HTML and component render
functions — no design system framework, just composable utilities.

This page builds three routes:

1. `/` — the dashboard: a list of notes + a research input
2. `/notes/:noteId` — read + edit a single note
3. `/research/:runId` — the live agent run viewer

Plus two render-function components: `<note-row>` and `<agent-event>`.

## SPA shell

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<title>Notebook</title>
		<link rel="stylesheet" href="/style.css">
	</head>
	<body class="bg-slate-50 text-slate-900">
		<main class="max-w-3xl mx-auto px-4 py-8">
			<!--ROUTES-->
		</main>
	</body>
</html>
```

The `max-w-3xl mx-auto` centers everything; routes inherit. Dark mode is left as an exercise — Tailwind's `dark:` variants handle it once
you add a toggle.

## Dashboard route

```html
<!-- public/routes/index.html -->
<header class="flex items-center justify-between mb-6">
	<h1 class="text-2xl font-semibold tracking-tight">Notebook</h1>
	<form id="ask" class="flex-1 ml-6">
		<input
			name="question"
			class="w-full px-3 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
			placeholder="Ask anything — or hold Shift+Enter to deep-research…"
			autofocus
		>
	</form>
</header>

<section
	id="answer"
	class="hidden mb-8 p-4 rounded-lg bg-white border border-slate-200 shadow-sm"
>
	<div id="answer-status" class="text-sm text-slate-500"></div>
	<article id="answer-body" class="prose prose-slate mt-2"></article>
	<ul id="answer-citations" class="mt-4 flex flex-wrap gap-2 text-sm"></ul>
</section>

<section>
	<h2 class="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
		Recent notes
	</h2>
	<ul id="notes" class="space-y-2"></ul>
</section>
```

```ts
// public/routes/index.js
import { $, createApp, html, render } from "@vynjs/client";
import { transformer } from "../../transform.ts";
import type { AppRouter } from "../../_vyn.gen.ts";
import type { Note } from "../../features/notes/note.ts";

const { rpc, cache } = createApp<AppRouter>({ transformer });

const askForm = $<HTMLFormElement>("#ask");
const answer = $<HTMLElement>("#answer");
const aStatus = $<HTMLElement>("#answer-status");
const aBody = $<HTMLElement>("#answer-body");
const aCites = $<HTMLElement>("#answer-citations");
const notesEl = $<HTMLUListElement>("#notes");

function paintNotes(notes: Note[]) {
	render(
		notesEl,
		notes.map((n) =>
			html`
				<li
					class="bg-white rounded-md border border-slate-200 hover:border-slate-300 transition"
				>
					<a href="/notes/${n._id}/" class="block px-4 py-3">
						<h3 class="font-medium">${n.title}</h3>
						<p class="text-sm text-slate-600 line-clamp-2">${n.body}</p>
						<div class="mt-1 flex items-center gap-2 text-xs text-slate-400">
							<time>${n.updatedAt.toLocaleString()}</time>
							${n.tags.map((t) =>
								html`
									<span class="px-1.5 py-0.5 rounded bg-slate-100">${t}</span>
								`
							)}
						</div>
					</a>
				</li>
			`
		),
	);
}

cache.subscribe(rpc.notes.list, paintNotes);
rpc.notes.onChanged.listen({}, {
	onValue: (event) => {
		cache.patch(rpc.notes.list, (list) => {
			switch (event.kind) {
				case "added":
					return [event.note, ...list];
				case "updated":
					return list.map((n) => n._id === event.note._id ? event.note : n);
				case "removed":
					return list.filter((n) => n._id !== event.note._id);
			}
		});
	},
});
void rpc.notes.list.query({});

askForm.addEventListener("submit", async (e) => {
	e.preventDefault();
	const input = askForm.elements.namedItem("question") as HTMLInputElement;
	const question = input.value.trim();
	if (!question) return;

	// Shift+Enter triggers deep research instead of the live agent
	const ke = (e as any).submitter?.shiftKey ||
		(askForm.dataset.deep === "true");
	if (ke) {
		const { runId } = await rpc.research.startDeepResearch.mutate({
			topic: question,
		});
		location.href = `/research/${runId}/`;
		return;
	}

	answer.classList.remove("hidden");
	aStatus.textContent = "Working…";
	aBody.textContent = "";
	aCites.innerHTML = "";

	const promise = rpc.agent.ask.mutate({ question }, {
		onTick: (event: any) => {
			if (event.kind === "status") aStatus.textContent = event.message;
			if (event.kind === "tool_call") {
				aStatus.textContent = `Calling ${event.tool}…`;
			}
			if (event.kind === "text_delta") aBody.textContent += event.text;
		},
	});

	const result = await promise;
	aStatus.textContent = "Done.";
	render(
		aCites,
		result.citations.map((url) =>
			html`
				<li>
					<a
						href="${url}"
						target="_blank"
						class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
					>${url}</a>
				</li>
			`
		),
	);
});
```

A single input does double duty — Enter for the streaming agent, Shift+Enter for the deep research job. The deep-research path redirects to
the run viewer, which we build next.

## Live agent run viewer

```html
<!-- public/routes/research/[runId].html -->
<a
	href="/"
	class="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
>
	<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
		<path
			d="M14 6l-1.4 1.4L17.2 12l-4.6 4.6L14 18l6-6z"
			transform="rotate(180 12 12)"
		/>
	</svg>
	Back
</a>

<header class="mb-6">
	<h1 id="topic" class="text-2xl font-semibold"></h1>
	<div id="status" class="mt-1 text-sm text-slate-500"></div>
	<div class="mt-3 h-1 rounded-full bg-slate-200 overflow-hidden">
		<div id="bar" class="h-full bg-indigo-600 transition-all" style="width: 0%"></div>
	</div>
</header>

<section class="space-y-2 mb-8">
	<h2 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
		Activity
	</h2>
	<ul id="events" class="text-sm space-y-1"></ul>
</section>

<section id="report" class="prose prose-slate hidden"></section>
<ul id="citations" class="mt-6 flex flex-wrap gap-2 text-sm"></ul>
```

```ts
// public/routes/research/[runId].js
import { $, createApp, html, render, useParams } from "@vynjs/client";
import { transformer } from "../../../transform.ts";
import type { AppRouter } from "../../../_vyn.gen.ts";

const { rpc } = createApp<AppRouter>({ transformer });
const { runId } = useParams("/research/:runId/");

const topicEl = $("#topic");
const statusEl = $("#status");
const bar = $<HTMLDivElement>("#bar");
const eventsEl = $<HTMLUListElement>("#events");
const reportEl = $("#report");
const citesEl = $<HTMLUListElement>("#citations");

// Load existing run state
const run = await rpc.research.getRun.query({ runId });
topicEl.textContent = run.topic;
statusEl.textContent = run.status;
if (run.result) renderResult(run.result);

// Tail the underlying job if still in progress
if (run.status === "running" || run.status === "queued") {
	const events: any[] = [];
	for await (const e of rpc.jobs.watch.iterate({ jobId: run.jobId })) {
		if (e.kind === "tick") {
			const t = e.payload;
			events.push(t);
			render(eventsEl, events.slice(-50).map(renderEvent));
			if (t.kind === "status") {
				statusEl.textContent = t.message;
				if (typeof t.progress === "number") {
					bar.style.width = `${t.progress * 100}%`;
				}
			}
		}
		if (e.kind === "result") {
			renderResult(e.value);
			statusEl.textContent = "Complete";
			bar.style.width = "100%";
		}
		if (e.kind === "error") {
			statusEl.textContent = `Failed: ${e.error.message}`;
		}
	}
}

function renderEvent(t: any) {
	switch (t.kind) {
		case "status":
			return html`
				<li class="text-slate-500">⋯ ${t.message}</li>
			`;
		case "tool_call":
			return html`
				<li>
					<span class="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">${t.tool}</span> ${JSON.stringify(t.input)
						.slice(0, 80)}
				</li>
			`;
		case "tool_result":
			return html`
				<li class="text-emerald-700">→ ${t
					.tool} returned ${Array.isArray(t.output) ? `${t.output.length} items` : "data"}</li>
			`;
		case "text_delta":
			return html`
				<li class="text-slate-400 italic">${t.text.slice(0, 80)}…</li>
			`;
		default:
			return html`
				<li>${JSON.stringify(t)}</li>
			`;
	}
}

function renderResult(result: { summary: string; citations: string[] }) {
	reportEl.classList.remove("hidden");
	reportEl.innerHTML = result.summary; // sanitize in real apps; this is a tutorial
	render(
		citesEl,
		result.citations.map((url) =>
			html`
				<li>
					<a
						href="${url}"
						target="_blank"
						class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
					>${url}</a>
				</li>
			`
		),
	);
}
```

The run viewer is two things:

1. A snapshot from `research.getRun` (read from MongoDB).
2. A live tail of the underlying job via `rpc.jobs.watch.iterate`, which the framework provides as a universal subscription.

The user can close the tab and come back — the snapshot loads, and if the job is still running, the live tail resumes from wherever it is.

## Single note view

This page is mostly the same as the auth tutorial's `[noteId].js`, restyled with Tailwind:

```html
<!-- public/routes/notes/[noteId].html -->
<a
	href="/"
	class="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
>← Back</a>

<input
	id="title"
	class="block w-full text-2xl font-semibold mb-2 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
>
<textarea
	id="body"
	rows="20"
	class="block w-full bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-2 resize-none"
></textarea>

<input
	id="tags"
	placeholder="Comma-separated tags"
	class="mt-4 w-full px-3 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
>
```

The JS module mirrors the auth tutorial. Skipping for brevity.

## Per-user preferences UI

A small drawer with toggles for push / email mode / in-app. When the email is in digest mode, two extra fields choose **when** the digest
arrives — the hour and the timezone:

```html
<aside
	class="fixed bottom-4 right-4 w-72 bg-white rounded-lg shadow-lg border border-slate-200 p-4 space-y-2 text-sm"
>
	<h3 class="font-semibold">Notifications</h3>

	<label class="flex items-center gap-2">
		<input type="checkbox" data-pref="push"> Push
	</label>
	<label class="flex items-center gap-2">
		<input type="checkbox" data-pref="inApp"> In-app
	</label>
	<label class="flex items-center gap-2">
		<input type="checkbox" data-pref="email.enabled"> Email
	</label>

	<select
		data-pref="email.mode"
		class="mt-1 w-full text-sm rounded border-slate-300"
	>
		<option value="instant">Instant</option>
		<option value="digest" selected>Daily digest</option>
	</select>

	<div id="digest-time" class="space-y-2 pt-2 border-t border-slate-100">
		<label class="flex items-center justify-between gap-2">
			<span>Cadence</span>
			<select id="cadence-picker" class="rounded border-slate-300 text-sm">
				<option value="daily">Daily</option>
				<option value="weekly">Weekly</option>
				<option value="weekdays">Weekdays only</option>
				<option value="custom">Custom (cron)</option>
				<option value="never">Never</option>
			</select>
		</label>
		<label
			id="weekday-row"
			class="flex items-center justify-between gap-2 hidden"
		>
			<span>Day</span>
			<select id="weekday-picker" class="rounded border-slate-300 text-sm">
				<option value="0">Sunday</option>
				<option value="1" selected>Monday</option>
				<option value="2">Tuesday</option>
				<option value="3">Wednesday</option>
				<option value="4">Thursday</option>
				<option value="5">Friday</option>
				<option value="6">Saturday</option>
			</select>
		</label>
		<label id="hour-row" class="flex items-center justify-between gap-2">
			<span>Hour</span>
			<select id="hour-picker" class="rounded border-slate-300 text-sm">
				${Array.from({ length: 24 }, (_, h) => `<option value="${h}">
					${String(h).padStart(2, "0")}:00
				</option>`).join("")}
			</select>
		</label>
		<label id="cron-row" class="flex items-center justify-between gap-2 hidden">
			<span>Cron</span>
			<input
				id="cron-input"
				class="rounded border-slate-300 text-sm w-40 font-mono"
				placeholder="0 9 * * 1"
			>
		</label>
		<label class="flex items-center justify-between gap-2">
			<span>Timezone</span>
			<input
				id="tz-input"
				class="rounded border-slate-300 text-sm w-40"
				placeholder="Europe/Oslo"
			>
		</label>
	</div>
</aside>
```

```ts
// detect the user's browser timezone as a default
const tzInput = $<HTMLInputElement>("#tz-input");
if (!tzInput.value) {
	tzInput.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const modeSelect = $<HTMLSelectElement>('[data-pref="email.mode"]');
const digestRow = $<HTMLDivElement>("#digest-time");
const cadenceSelect = $<HTMLSelectElement>("#cadence-picker");
const weekdayRow = $<HTMLLabelElement>("#weekday-row");
const hourRow = $<HTMLLabelElement>("#hour-row");
const cronRow = $<HTMLLabelElement>("#cron-row");
const weekdaySelect = $<HTMLSelectElement>("#weekday-picker");
const hourSelect = $<HTMLSelectElement>("#hour-picker");
const cronInput = $<HTMLInputElement>("#cron-input");

function syncDigestRow() {
	digestRow.classList.toggle("hidden", modeSelect.value !== "digest");
}

// Each cadence option determines which sub-rows are visible.
function syncCadenceRows() {
	const c = cadenceSelect.value;
	weekdayRow.classList.toggle("hidden", c !== "weekly");
	hourRow.classList.toggle("hidden", c === "never" || c === "custom");
	cronRow.classList.toggle("hidden", c !== "custom");
}

// Translate picker state → a cron string the framework stores as the preference.
function pickerToCron(): string | null {
	const hour = Number(hourSelect.value);
	switch (cadenceSelect.value) {
		case "daily":
			return `0 ${hour} * * *`;
		case "weekdays":
			return `0 ${hour} * * 1-5`;
		case "weekly":
			return `0 ${hour} * * ${weekdaySelect.value}`;
		case "custom":
			return cronInput.value.trim() || null;
		case "never":
			return null;
	}
	return null;
}

// Translate a stored cron back to the picker shape on load (best-effort).
function cronToPicker(cron: string | null | undefined) {
	if (!cron) {
		cadenceSelect.value = "never";
		return;
	}
	if (cron === "0 8 * * *" || /^0 \d+ \* \* \*$/.test(cron)) {
		cadenceSelect.value = "daily";
		hourSelect.value = String(Number(cron.split(" ")[1]));
		return;
	}
	if (/^0 \d+ \* \* 1-5$/.test(cron)) {
		cadenceSelect.value = "weekdays";
		hourSelect.value = String(Number(cron.split(" ")[1]));
		return;
	}
	if (/^0 \d+ \* \* [0-6]$/.test(cron)) {
		cadenceSelect.value = "weekly";
		hourSelect.value = String(Number(cron.split(" ")[1]));
		weekdaySelect.value = cron.split(" ")[4];
		return;
	}
	cadenceSelect.value = "custom";
	cronInput.value = cron;
}

cadenceSelect.addEventListener("change", syncCadenceRows);
modeSelect.addEventListener("change", syncDigestRow);
syncDigestRow();
syncCadenceRows();

// Persist on any change.
drawer.addEventListener("change", async () => {
	const cron = pickerToCron();
	const tz = tzInput.value || Intl.DateTimeFormat().resolvedOptions().timeZone;
	await rpc.auth.setPreferences.mutate({
		push: ($<HTMLInputElement>('[data-pref="push"]')).checked,
		inApp: ($<HTMLInputElement>('[data-pref="inApp"]')).checked,
		email: {
			enabled: ($<HTMLInputElement>('[data-pref="email.enabled"]')).checked,
			mode: modeSelect.value,
		},
		digests: {
			"research.researchReady": {
				email: cron ? { cron, timezone: tz } : null,
			},
		},
	});
});
```

Three payoffs:

- **Browser-detected timezone default** — `Intl.DateTimeFormat()
  .resolvedOptions().timeZone` returns IANA names like `"Europe/Oslo"`,
  exactly what the framework expects.
- **Cadence picker → cron translation** — friendly UI on the outside, standard cron on the wire. Custom-cron users get an advanced field;
  defaults cover the 95% case.
- **Digest-only rows hide when mode is instant** — Tailwind's `hidden` class is one DOM toggle; no JS animation library.

## Where you are

You have a complete app:

- Dashboard with a single ask box doing double duty (live agent vs deep research)
- Streaming live answer with citations, agent-event timeline
- Background research that survives reloads, with per-channel notifications when done
- Per-user preferences honored across push / email / in-app
- Tailwind utilities throughout — no custom CSS beyond the tokens

## Next steps

- **Embeddings + similarity search.** Replace the text index with a vector store (e.g. MongoDB Atlas Vector Search). Add an embedding step
  to `notes.create`; the agent's tool list grows by one.
- **Multi-user threads.** Share research runs across users via the `Note.userId` indirection. Use `createSubscription` to stream
  collaborator presence.
- **Eval / observability.** Hook `notify.failed`, `job.failed`, and the agent's tool-result events into your APM via the
  [transport wrapper](/vyn/guide/transport/) pattern.
- **Mobile.** The Web Push channel already works on mobile browsers; wrap the same pages in a PWA shell for installable behavior.

## See also

- [Agents](/vyn/guide/agents/) — the composition pattern this tutorial demonstrates
- [Jobs](/vyn/guide/jobs/), [Notifications](/vyn/guide/notifications/), [Transport](/vyn/guide/transport/)
- [Configuration](/vyn/guide/configuration/) — `transformer`, `staticContext`, `createContext`, `notify`, `jobs`
- [Build notes with auth](/vyn/tutorials/build-notes-with-auth/) — the simpler tutorial this builds on

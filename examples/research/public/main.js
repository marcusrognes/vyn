import { createApp, html, render } from "/_vyn/client.js";
import superjson from "https://esm.sh/superjson@2.2.2";

const transformer = {
	serialize: (v) => superjson.serialize(v),
	deserialize: (v) => superjson.deserialize(v),
};

const { rpc } = createApp({ transformer });
const route = document.getElementById("route");
const bell = document.getElementById("bell");
const badge = document.getElementById("badge");
const inboxEl = document.getElementById("inbox");

function escape(s) {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
		/>/g,
		"&gt;",
	);
}

// ─── routing ─────────────────────────────────────────────────────────
async function navigate() {
	const path = location.pathname;
	const m = path.match(/^\/research\/([0-9a-f-]+)\/?$/i);
	if (m) await renderRun(m[1]);
	else renderDashboard();
}
window.addEventListener("popstate", navigate);
document.addEventListener("click", (e) => {
	const a = e.target.closest("a[href^='/']");
	if (a && a.target !== "_blank" && a.origin === location.origin) {
		e.preventDefault();
		history.pushState({}, "", a.getAttribute("href"));
		navigate();
	}
});

// ─── dashboard ───────────────────────────────────────────────────────
function renderDashboard() {
	route.innerHTML = `
		<form id="ask" class="flex gap-2 mb-6">
			<input name="question" required autofocus
			       class="flex-1 px-3 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
			       placeholder="Ask anything — Shift+Enter for deep research">
			<button type="submit" class="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500">Ask</button>
		</form>
		<section id="result" hidden class="bg-white border border-slate-200 rounded-lg p-4 mb-6">
			<div id="status" class="text-sm text-slate-500"></div>
			<article id="answer" class="prose prose-slate mt-2"></article>
			<ul id="citations" class="mt-3 flex flex-wrap gap-2 text-sm"></ul>
		</section>
	`;
	const form = document.getElementById("ask");
	const result = document.getElementById("result");
	const statusEl = document.getElementById("status");
	const answerEl = document.getElementById("answer");
	const citesEl = document.getElementById("citations");

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		const question = new FormData(form).get("question");
		const deep = e.submitter?.shiftKey;
		form.querySelector("input").value = "";
		if (deep) {
			const { runId } = await rpc.research.startDeepResearch.mutate({
				topic: question,
			});
			history.pushState({}, "", `/research/${runId}`);
			await renderRun(runId);
			return;
		}
		result.hidden = false;
		statusEl.textContent = "Working…";
		answerEl.textContent = "";
		citesEl.innerHTML = "";
		const out = await rpc.agent.ask.mutate({ question }, {
			onTick(event) {
				if (event.kind === "status") statusEl.textContent = event.message;
				if (event.kind === "tool_call") {
					statusEl.textContent = `Calling ${event.tool}…`;
				}
				if (event.kind === "text_delta") answerEl.textContent += event.text;
			},
		});
		statusEl.textContent = "Done";
		render(
			citesEl,
			out.citations.map((c) =>
				html`
					<li>
						<a
							href="${c}"
							target="_blank"
							class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
						>${c}</a>
					</li>
				`
			),
		);
	});
}

// ─── run viewer ──────────────────────────────────────────────────────
async function renderRun(runId) {
	route.innerHTML = `
		<a href="/" class="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">← Back</a>
		<h2 id="topic" class="text-xl font-semibold"></h2>
		<div id="status" class="text-sm text-slate-500"></div>
		<div class="mt-3 h-1 rounded-full bg-slate-200 overflow-hidden">
			<div id="bar" class="h-full bg-indigo-600 transition-all" style="width:0%"></div>
		</div>
		<section class="mt-6">
			<h3 class="text-xs uppercase font-semibold text-slate-500 mb-2">Activity</h3>
			<ul id="events" class="text-sm font-mono space-y-1 bg-slate-50 p-3 rounded-md"></ul>
		</section>
		<article id="report" class="prose prose-slate mt-6" hidden></article>
		<ul id="citations" class="mt-4 flex flex-wrap gap-2 text-sm"></ul>
	`;
	const topicEl = document.getElementById("topic");
	const statusEl = document.getElementById("status");
	const bar = document.getElementById("bar");
	const eventsEl = document.getElementById("events");
	const reportEl = document.getElementById("report");
	const citesEl = document.getElementById("citations");

	const run = await rpc.research.getRun.mutate({ runId });
	topicEl.textContent = run?.topic ?? "(unknown)";
	statusEl.textContent = run?.status ?? "unknown";

	if (run?.status === "completed" && run?.result) {
		paintResult(run.result);
		return;
	}

	if (!run?.jobId) {
		statusEl.textContent = "no job id";
		return;
	}

	const events = [];
	for await (
		const e of rpc.research.deepResearch.iterate({ jobId: run.jobId })
	) {
		if (e.kind === "tick") {
			events.push(e.payload);
			eventsEl.innerHTML = events.slice(-20).map((p) => `<li>⋯ ${escape(p.stage)} ${Math.round((p.pct ?? 0) * 100)}%</li>`).join("");
			if (typeof e.payload.pct === "number") {
				bar.style.width = `${e.payload.pct * 100}%`;
			}
			statusEl.textContent = e.payload.stage;
		}
		if (e.kind === "result") {
			statusEl.textContent = "Complete";
			bar.style.width = "100%";
		}
		if (e.kind === "error") statusEl.textContent = `Failed: ${e.error.message}`;
	}

	// Reload final run from server.
	const final = await rpc.research.getRun.mutate({ runId });
	if (final?.result) paintResult(final.result);

	function paintResult(r) {
		reportEl.hidden = false;
		reportEl.textContent = r.summary;
		citesEl.innerHTML = (r.citations ?? [])
			.map((c) =>
				`<li><a href="${c}" target="_blank" class="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">${
					escape(c)
				}</a></li>`
			)
			.join("");
	}
}

// ─── inbox bell ──────────────────────────────────────────────────────
async function refreshBadge() {
	const { count } = await rpc.inbox.count.query({ unreadOnly: true });
	badge.textContent = count > 0 ? String(count) : "";
	badge.classList.toggle("hidden", count === 0);
	badge.classList.toggle("flex", count > 0);
}

async function showInbox() {
	const rows = await rpc.inbox.list.query({ unreadOnly: false, limit: 20 });
	inboxEl.hidden = false;
	bell.setAttribute("aria-expanded", "true");
	inboxEl.innerHTML = rows.length === 0
		? `<div class="p-4 text-sm text-slate-500">Nothing yet.</div>`
		: `<ul class="divide-y divide-slate-200">
			${
			rows.map((r) => `
				<li data-id="${r._id}" class="px-4 py-3 hover:bg-slate-50 cursor-pointer ${r.readAt ? "" : "bg-indigo-50/40"}">
					<div class="font-medium text-sm">${escape(r.payload?.title ?? r.notification)}</div>
					<div class="text-sm text-slate-600 line-clamp-2">${escape(r.payload?.body ?? "")}</div>
					<div class="text-xs text-slate-400 mt-1">${new Date(r.createdAt).toLocaleString()}</div>
				</li>
			`).join("")
		}
		</ul>`;
}

bell.addEventListener("click", async () => {
	if (inboxEl.hidden) await showInbox();
	else {
		inboxEl.hidden = true;
		bell.setAttribute("aria-expanded", "false");
	}
});

inboxEl.addEventListener("click", async (e) => {
	const li = e.target.closest("li[data-id]");
	if (!li) return;
	await rpc.inbox.markRead.mutate({ _id: li.dataset.id });
	li.classList.remove("bg-indigo-50/40");
	refreshBadge();
	// If the row links to a research run, navigate there.
	const rows = await rpc.inbox.list.query({ limit: 20 });
	const row = rows.find((r) => r._id === li.dataset.id);
	if (row?.payload?.runId) {
		inboxEl.hidden = true;
		bell.setAttribute("aria-expanded", "false");
		history.pushState({}, "", `/research/${row.payload.runId}`);
		navigate();
	}
});

rpc.research.onNotification.listen({}, {
	onValue: () => {
		refreshBadge();
	},
});

await refreshBadge();
await navigate();

import { createApp } from "/_vyn/client.js";
import superjson from "https://esm.sh/superjson@2.2.2";

const transformer = {
	serialize:   (v) => superjson.serialize(v),
	deserialize: (v) => superjson.deserialize(v),
};

const { rpc } = createApp({ transformer });

const form     = document.getElementById("ask");
const resultEl = document.getElementById("result");

form.addEventListener("submit", async (e) => {
	e.preventDefault();
	const question = new FormData(form).get("question");
	form.querySelector("input").value = "";

	const events = [];
	resultEl.innerHTML = `
		<div id="status" class="status">Working…</div>
		<div id="answer" class="answer"></div>
		<div id="events" class="events"></div>
	`;
	const statusEl = document.getElementById("status");
	const answerEl = document.getElementById("answer");
	const evEl     = document.getElementById("events");

	const result = await rpc.agent.ask.mutate({ question }, {
		onTick(event) {
			events.push(event);
			evEl.innerHTML = events.slice(-20).map((e) => formatEvent(e)).join("<br>");
			evEl.scrollTop = evEl.scrollHeight;
			if (event.kind === "status")     statusEl.textContent = event.message;
			if (event.kind === "text_delta") answerEl.textContent += event.text;
		},
	});

	statusEl.textContent = "Complete";
	if (result.citations.length) {
		answerEl.innerHTML += `<div style="margin-top:0.5rem"><strong>Sources:</strong> ${
			result.citations.map((c) => `<a href="${c}" target="_blank">${c}</a>`).join(", ")
		}</div>`;
	}
});

function formatEvent(e) {
	switch (e.kind) {
		case "status":      return `<span class="event-status">⋯ ${e.message}${e.progress != null ? ` (${Math.round(e.progress * 100)}%)` : ""}</span>`;
		case "tool_call":   return `<span class="event-tool">→ ${e.tool}(${JSON.stringify(e.input)})</span>`;
		case "tool_result": return `<span class="event-result">← ${e.tool}</span>`;
		case "text_delta":  return `<span style="color:#94a3b8">${e.text}</span>`;
		default:            return JSON.stringify(e);
	}
}

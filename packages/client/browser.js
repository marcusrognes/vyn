// Browser bundle of @vynjs/client — single ESM file, no build step.
// Served by @vynjs/server at /_vyn/client.js so app routes can
// import { createApp, html, render, ... } from "/_vyn/client.js"
// without a bundler.

// ─── signal ──────────────────────────────────────────────────────────
export function signal(initial) {
	let value = initial;
	const subs = new Set();
	const fn = () => value;
	fn.set    = (next) => { if (Object.is(value, next)) return; value = next; subs.forEach((cb) => cb(value)); };
	fn.update = (mut) => fn.set(mut(value));
	fn.subscribe = (cb) => { subs.add(cb); return () => subs.delete(cb); };
	return fn;
}

// ─── html / render ───────────────────────────────────────────────────
function isHtml(v) { return v && typeof v === "object" && v.__html === true; }
function escape(s) {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function interp(v) {
	if (v == null || v === false) return "";
	if (v === true) return "true";
	if (Array.isArray(v)) return v.map(interp).join("");
	if (isHtml(v)) return v.source;
	if (v instanceof Date) return escape(v.toLocaleString());
	if (typeof v === "object") return escape(JSON.stringify(v));
	return escape(v);
}
export function html(strings, ...values) {
	let out = "";
	for (let i = 0; i < strings.length; i++) {
		out += strings[i];
		if (i < values.length) out += interp(values[i]);
	}
	return { __html: true, source: out };
}
export function render(el, content) {
	if (content == null) { el.innerHTML = ""; return; }
	if (Array.isArray(content)) {
		el.innerHTML = content.map((c) => (isHtml(c) ? c.source : interp(c))).join("");
		return;
	}
	if (typeof content === "string") { el.textContent = content; return; }
	el.innerHTML = content.source;
}

// ─── dom helpers ─────────────────────────────────────────────────────
export function $(selector, root = document) {
	const el = root.querySelector(selector);
	if (!el) throw new Error(`element not found: ${selector}`);
	return el;
}
export function $$(selector, root = document) {
	return [...root.querySelectorAll(selector)];
}
export function on(root, type, selector, handler) {
	const listener = (e) => {
		const t = e.target.closest(selector);
		if (t && root.contains(t)) handler(e, t);
	};
	root.addEventListener(type, listener);
	return () => root.removeEventListener(type, listener);
}

// ─── component ───────────────────────────────────────────────────────
export function component(name, setup) {
	if (customElements.get(name)) return;
	class Vc extends HTMLElement {
		connectedCallback() {
			const props = new Proxy({}, {
				get: (_, key) => {
					if (typeof key !== "string") return undefined;
					const v = this.dataset[key];
					if (v !== undefined) { try { return JSON.parse(v); } catch { return v; } }
					return this[key];
				},
			});
			const cleanup = setup({
				el:     this,
				props,
				render: (content) => render(this, content),
				on:     (type, handler) => this.addEventListener(type, handler),
			});
			if (typeof cleanup === "function") this.__dispose = cleanup;
		}
		disconnectedCallback() { this.__dispose?.(); }
	}
	customElements.define(name, Vc);
}

// ─── transformer + rpc ───────────────────────────────────────────────
export const identityTransformer = { serialize: (v) => v, deserialize: (v) => v };

function decodeError(e) {
	const err = new Error(e?.message ?? "rpc error");
	err.category = e?.category;
	err.details  = e?.details;
	return err;
}

class SubscriptionManager {
	constructor(url, t) {
		this.url = url; this.t = t;
		this.subs = new Map(); this.idSeq = 0;
		this.pending = [];
	}
	ensure() {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
		if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
			return new Promise((r) => this.pending.push(r));
		}
		this.ws = new WebSocket(`${this.url}/ws`);
		this.ws.addEventListener("message", (e) => {
			const f = JSON.parse(e.data);
			const s = this.subs.get(f.id);
			if (!s) return;
			if (f.kind === "value") s.onValue?.(this.t.deserialize(f.payload));
			else if (f.kind === "error") s.onError?.(decodeError(f.error));
			else if (f.kind === "end")   { s.onEnd?.(); this.subs.delete(f.id); }
		});
		return new Promise((resolve) => {
			this.ws.addEventListener("open", () => {
				this.pending.splice(0).forEach((fn) => fn());
				resolve();
			});
		});
	}
	subscribe(action, input, handlers) {
		const id = String(++this.idSeq);
		this.subs.set(id, handlers);
		this.ensure().then(() => {
			this.ws.send(JSON.stringify({ id, action, op: "subscribe", input: input === undefined ? undefined : this.t.serialize(input) }));
		});
		return () => {
			if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ id, op: "unsubscribe" }));
			this.subs.delete(id);
		};
	}
	async *iterate(action, input, signal) {
		const buf = []; let resolve = null; let done = false; let error = null;
		const un = this.subscribe(action, input, {
			onValue: (v) => { buf.push(v); if (resolve) { const r = resolve; resolve = null; r(); } },
			onError: (e) => { error = e; done = true; if (resolve) { const r = resolve; resolve = null; r(); } },
			onEnd:   ()  => { done = true; if (resolve) { const r = resolve; resolve = null; r(); } },
		});
		signal?.addEventListener("abort", () => { done = true; un(); });
		try {
			while (!done) {
				while (buf.length) yield buf.shift();
				if (done) break;
				await new Promise((r) => { resolve = r; });
			}
			if (error) throw error;
		} finally { un(); }
	}
}

async function runStreaming(url, body, onTick, t, signal) {
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", accept: "text/event-stream" },
		body, signal,
	});
	if (!res.body) throw new Error("no response body");
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "", result, error;
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let idx;
		while ((idx = buffer.indexOf("\n\n")) >= 0) {
			const event = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
			const lines = event.split("\n");
			let type = "message", data = "";
			for (const ln of lines) {
				if (ln.startsWith("event: ")) type = ln.slice(7);
				if (ln.startsWith("data: "))  data += ln.slice(6);
			}
			const parsed = data ? t.deserialize(JSON.parse(data)) : undefined;
			if (type === "tick") onTick(parsed);
			else if (type === "result") result = parsed;
			else if (type === "error")  error  = parsed;
		}
	}
	if (error) throw decodeError(error);
	return result;
}

export function createRpcClient(opts = {}) {
	const baseUrl = opts.baseUrl ?? location.origin;
	const wsUrl   = opts.wsUrl ?? baseUrl.replace(/^http/, "ws");
	const t       = opts.transformer ?? identityTransformer;
	const wsMgr   = new SubscriptionManager(wsUrl, t);

	function makeProxy(path) {
		const target = () => {};
		const handler = {
			get(_, key) {
				if (typeof key !== "string") return undefined;
				if (key === "__name") return path.join(".");
				if (key === "query" || key === "mutate") {
					return async (input, callOpts = {}) => {
						const name = path.join(".");
						const body = JSON.stringify({ input: input === undefined ? undefined : t.serialize(input) });
						if (callOpts.onTick) {
							return runStreaming(`${baseUrl}/rpc/${name}`, body, callOpts.onTick, t, callOpts.signal);
						}
						const res = await fetch(`${baseUrl}/rpc/${name}`, {
							method:  "POST",
							headers: { "content-type": "application/json" },
							body,
							signal:  callOpts.signal,
						});
						const json = await res.json();
						if (!json.ok) throw decodeError(json.error);
						return json.result === null ? undefined : t.deserialize(json.result);
					};
				}
				if (key === "listen") {
					return (input, handlers) => wsMgr.subscribe(path.join("."), input, handlers);
				}
				if (key === "iterate") {
					return (input, callOpts = {}) => wsMgr.iterate(path.join("."), input, callOpts.signal);
				}
				return makeProxy([...path, key]);
			},
		};
		return new Proxy(target, handler);
	}

	return makeProxy([]);
}

// ─── cache ───────────────────────────────────────────────────────────
function stable(value) {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
	const keys = Object.keys(value).sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
}

export class Cache {
	constructor() { this.entries = new Map(); }
	keyFor(callable, input) {
		const name = callable.__name ?? "unknown";
		return `${name}:${stable(input)}`;
	}
	get(callable, input) { return this.entries.get(this.keyFor(callable, input))?.value; }
	set(callable, input, value) {
		const key = this.keyFor(callable, input);
		const entry = this.entries.get(key) ?? { value, listeners: new Set() };
		entry.value = value;
		this.entries.set(key, entry);
		entry.listeners.forEach((fn) => fn(value));
	}
	patch(callable, fn, input) {
		const name = callable.__name;
		for (const [key, entry] of this.entries.entries()) {
			if (input !== undefined) {
				if (key !== this.keyFor(callable, input)) continue;
			} else if (!key.startsWith(`${name}:`)) continue;
			entry.value = fn(entry.value);
			entry.listeners.forEach((l) => l(entry.value));
		}
	}
	invalidate(callable, input) {
		const name = callable.__name;
		for (const key of [...this.entries.keys()]) {
			if (input !== undefined && key !== this.keyFor(callable, input)) continue;
			if (input === undefined && !key.startsWith(`${name}:`)) continue;
			this.entries.delete(key);
		}
	}
	subscribe(callable, listener, input) {
		const key = input !== undefined ? this.keyFor(callable, input) : `${callable.__name}:`;
		let entry = this.entries.get(key);
		if (!entry) { entry = { value: undefined, listeners: new Set() }; this.entries.set(key, entry); }
		entry.listeners.add(listener);
		return () => entry.listeners.delete(listener);
	}
}

// ─── app ─────────────────────────────────────────────────────────────
export function createApp(opts = {}) {
	return { rpc: createRpcClient(opts), cache: new Cache() };
}

// RPC client. The proxy yields a typed object shape so app code can
// write rpc.notes.list.query({ ... }) and TypeScript infers the
// input/output from the AppRouter shape. At runtime the proxy walks
// the path and builds a `.` separated action name to POST.

import type { Transformer } from "./transformer.ts";
import { identityTransformer } from "./transformer.ts";

export type CallOpts = {
	onTick?: (event: unknown) => void;
	signal?: AbortSignal;
};

export type RpcCallable<I, O> = {
	query?: (input?: I, opts?: CallOpts) => Promise<O>;
	mutate?: (input?: I, opts?: CallOpts) => Promise<O>;
	listen?: (input: I, handlers: SubscriptionHandlers<O>) => () => void;
	iterate?: (input: I, opts?: { signal?: AbortSignal }) => AsyncIterable<O>;
};

export type SubscriptionHandlers<O> = {
	onValue?: (value: O) => void;
	onError?: (err: unknown) => void;
	onEnd?: () => void;
};

// Action types in @vynjs/core erase their I/O generics onto `Schema<unknown>`
// at the `input`/`output` fields. The original `O` survives in `run`'s
// return type, so we infer from there. Same for `I` via run's opts.input.
type RunInput<T> = T extends { run: (opts: { input: infer I } & Record<string, unknown>) => unknown } ? I
	: unknown;
type RunOutput<T> = T extends { run: (...args: never[]) => infer R } ? R extends Promise<infer P> ? P
	: R extends AsyncGenerator<infer G> ? G
	: R extends AsyncIterable<infer A> ? A
	: unknown
	: unknown;

export type RpcClient<R> = {
	[K in keyof R]: R[K] extends { kind: "query" } ? {
			query(input?: RunInput<R[K]>, opts?: CallOpts): Promise<RunOutput<R[K]>>;
		}
		: R[K] extends { kind: "mutation" } ? {
				mutate(
					input?: RunInput<R[K]>,
					opts?: CallOpts,
				): Promise<RunOutput<R[K]>>;
			}
		: R[K] extends { kind: "subscription" } ? {
				listen(
					input: RunInput<R[K]>,
					handlers: SubscriptionHandlers<RunOutput<R[K]>>,
				): () => void;
				iterate(
					input: RunInput<R[K]>,
					opts?: { signal?: AbortSignal },
				): AsyncIterable<RunOutput<R[K]>>;
			}
		: R[K] extends Record<string, unknown> ? RpcClient<R[K]>
		: RpcCallable<any, any>;
};

export type ClientOpts = {
	baseUrl?: string; // defaults to current origin
	wsUrl?: string;
	transformer?: Transformer;
	fetch?: typeof globalThis.fetch;
};

export function createRpcClient<R = unknown>(
	opts: ClientOpts = {},
): RpcClient<R> {
	const baseUrl = opts.baseUrl ??
		(typeof location !== "undefined" ? location.origin : "");
	const wsUrl = opts.wsUrl ?? baseUrl.replace(/^http/, "ws");
	const t = opts.transformer ?? identityTransformer;
	const fetch = opts.fetch ?? globalThis.fetch;

	const wsManager = new SubscriptionManager(wsUrl, t);

	function makeProxy(path: string[]): any {
		const name = path.join(".");
		const target: any = function () {};
		return new Proxy(target, {
			get(_, key) {
				if (typeof key !== "string") return undefined;
				if (key === "query" || key === "mutate") {
					return async (input?: unknown, callOpts: CallOpts = {}) => {
						const body = JSON.stringify({
							input: input === undefined ? undefined : t.serialize(input),
						});
						if (callOpts.onTick) {
							return runStreaming(
								fetch,
								`${baseUrl}/rpc/${name}`,
								body,
								callOpts.onTick,
								t,
								callOpts.signal,
							);
						}
						const res = await fetch(`${baseUrl}/rpc/${name}`, {
							method: "POST",
							headers: { "content-type": "application/json" },
							body,
							signal: callOpts.signal,
						});
						const json = await res.json();
						if (!json.ok) throw decodeError(json.error);
						return json.result === null ? undefined : t.deserialize(json.result);
					};
				}
				if (key === "listen") {
					return (input: unknown, handlers: SubscriptionHandlers<unknown>) => wsManager.subscribe(name, input, handlers);
				}
				if (key === "iterate") {
					return (input: unknown, callOpts: { signal?: AbortSignal } = {}) => wsManager.iterate(name, input, callOpts.signal);
				}
				return makeProxy([...path, key]);
			},
		});
	}

	return makeProxy([]) as RpcClient<R>;
}

async function runStreaming(
	fetchFn: typeof globalThis.fetch,
	url: string,
	body: string,
	onTick: (event: unknown) => void,
	t: Transformer,
	signal?: AbortSignal,
): Promise<unknown> {
	const res = await fetchFn(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "text/event-stream",
		},
		body,
		signal,
	});
	if (!res.body) throw new Error("no response body");
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let result: unknown = undefined;
	let error: unknown = null;

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		let idx;
		while ((idx = buffer.indexOf("\n\n")) >= 0) {
			const event = buffer.slice(0, idx);
			buffer = buffer.slice(idx + 2);
			const lines = event.split("\n");
			let evType = "message", evData = "";
			for (const ln of lines) {
				if (ln.startsWith("event: ")) evType = ln.slice(7);
				if (ln.startsWith("data: ")) evData += ln.slice(6);
			}
			const data = evData ? t.deserialize(JSON.parse(evData)) : undefined;
			if (evType === "tick") onTick(data);
			else if (evType === "result") result = data;
			else if (evType === "error") error = data;
		}
	}
	if (error) throw decodeError(error);
	return result;
}

function decodeError(e: any) {
	const err = new Error(e?.message ?? "rpc error");
	(err as any).category = e?.category;
	(err as any).details = e?.details;
	return err;
}

class SubscriptionManager {
	private ws?: WebSocket;
	private pending: Array<() => void> = [];
	private subs = new Map<string, SubscriptionHandlers<unknown>>();
	private idSeq = 0;

	constructor(private url: string, private t: Transformer) {}

	private ensureSocket() {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			return Promise.resolve();
		}
		if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
			return new Promise<void>((r) => this.pending.push(r));
		}
		this.ws = new WebSocket(`${this.url}/ws`);
		this.ws.addEventListener("message", (e) => {
			try {
				const frame = JSON.parse(e.data);
				const sub = this.subs.get(frame.id);
				if (!sub) return;
				if (frame.kind === "value") {
					sub.onValue?.(this.t.deserialize(frame.payload));
				} else if (frame.kind === "error") {
					sub.onError?.(decodeError(frame.error));
				} else if (frame.kind === "end") {
					sub.onEnd?.();
					this.subs.delete(frame.id);
				}
			} catch (err) {
				console.error("[rpc] ws message parse error:", err);
			}
		});
		return new Promise<void>((resolve) => {
			this.ws!.addEventListener("open", () => {
				this.pending.splice(0).forEach((fn) => fn());
				resolve();
			});
		});
	}

	subscribe(
		action: string,
		input: unknown,
		handlers: SubscriptionHandlers<unknown>,
	): () => void {
		const id = String(++this.idSeq);
		this.subs.set(id, handlers);
		this.ensureSocket().then(() => {
			this.ws!.send(JSON.stringify({
				id,
				action,
				op: "subscribe",
				input: input === undefined ? undefined : this.t.serialize(input),
			}));
		});
		return () => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ id, op: "unsubscribe" }));
			}
			this.subs.delete(id);
		};
	}

	async *iterate(
		action: string,
		input: unknown,
		signal?: AbortSignal,
	): AsyncIterable<unknown> {
		const buffer: unknown[] = [];
		let resolve: (() => void) | null = null;
		let done = false;
		let error: unknown = null;
		const unsubscribe = this.subscribe(action, input, {
			onValue: (v) => {
				buffer.push(v);
				if (resolve) {
					const r = resolve;
					resolve = null;
					r();
				}
			},
			onError: (e) => {
				error = e;
				done = true;
				if (resolve) {
					const r = resolve;
					resolve = null;
					r();
				}
			},
			onEnd: () => {
				done = true;
				if (resolve) {
					const r = resolve;
					resolve = null;
					r();
				}
			},
		});
		signal?.addEventListener("abort", () => {
			done = true;
			unsubscribe();
		});
		try {
			while (!done) {
				while (buffer.length) yield buffer.shift();
				if (done) break;
				await new Promise<void>((r) => {
					resolve = r;
				});
			}
			if (error) throw error;
		} finally {
			unsubscribe();
		}
	}
}

// Client-side cache. Keys are (action, JSON-stringified input).
// Each entry maintains its own value + subscriber list.

import type { RpcCallable } from "./rpc.ts";

type Key = `${string}:${string}`;
type Entry = { value: unknown; listeners: Set<(value: unknown) => void> };

export class Cache {
	private entries = new Map<Key, Entry>();

	private keyFor(callable: RpcCallable<any, any>, input: unknown): Key {
		const name = (callable as any).__name as string ?? "unknown";
		return `${name}:${stableStringify(input)}` as Key;
	}

	get<I, O>(callable: RpcCallable<I, O>, input: I): O | undefined {
		return this.entries.get(this.keyFor(callable, input))?.value as O | undefined;
	}

	set<I, O>(callable: RpcCallable<I, O>, input: I, value: O) {
		const key   = this.keyFor(callable, input);
		const entry = this.entries.get(key) ?? { value, listeners: new Set() };
		entry.value = value;
		this.entries.set(key, entry);
		entry.listeners.forEach((fn) => fn(value));
	}

	patch<I, O>(callable: RpcCallable<I, O>, fn: (value: O) => O, input?: I) {
		// Patch all entries for this callable when input not specified.
		const name = (callable as any).__name as string;
		for (const [key, entry] of this.entries.entries()) {
			if (input !== undefined) {
				if (key !== this.keyFor(callable, input)) continue;
			} else if (!key.startsWith(`${name}:`)) continue;
			entry.value = fn(entry.value as O);
			entry.listeners.forEach((listener) => listener(entry.value));
		}
	}

	invalidate<I, O>(callable: RpcCallable<I, O>, input?: I) {
		const name = (callable as any).__name as string;
		for (const key of [...this.entries.keys()]) {
			if (input !== undefined && key !== this.keyFor(callable, input)) continue;
			if (input === undefined && !key.startsWith(`${name}:`)) continue;
			this.entries.delete(key);
		}
	}

	subscribe<I, O>(callable: RpcCallable<I, O>, listener: (value: O) => void, input?: I): () => void {
		const key = input !== undefined ? this.keyFor(callable, input) : `${(callable as any).__name}:` as Key;
		let entry = this.entries.get(key);
		if (!entry) { entry = { value: undefined, listeners: new Set() }; this.entries.set(key, entry); }
		entry.listeners.add(listener as (v: unknown) => void);
		return () => entry!.listeners.delete(listener as (v: unknown) => void);
	}
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	const keys = Object.keys(value).sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(",")}}`;
}

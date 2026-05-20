// Small utilities re-exported under @vyn/core/util for the helpers
// tutorials reach for.

/** Generate a v4 UUID. Uses the platform's `crypto.randomUUID()` in both Node and the browser. */
export function uuid(): string {
	return crypto.randomUUID();
}

/** Sleep for `ms` milliseconds. Useful in async generators + jobs. */
export function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/** Standard JSON deep-clone. */
export function deepClone<T>(value: T): T {
	return structuredClone(value);
}

/** Group an array by a key fn. Keys keep insertion order. */
export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K): Record<K, T[]> {
	const out: Record<K, T[]> = {} as Record<K, T[]>;
	for (const item of items) {
		const k = key(item);
		(out[k] ??= []).push(item);
	}
	return out;
}

/** Stable shallow `Object.keys(o).sort()` JSON for cache key derivation. */
export function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	const keys = Object.keys(value).sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

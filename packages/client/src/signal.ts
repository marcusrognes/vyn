// Tiny signal primitive. Synchronous read, subscribe to changes.
// Used for component-local state and as the inner mechanism behind
// cache subscriptions.

export type Signal<T> = {
	(): T;
	set(value: T): void;
	update(fn: (value: T) => T): void;
	subscribe(fn: (value: T) => void): () => void;
};

export function signal<T>(initial: T): Signal<T> {
	let value     = initial;
	const subs    = new Set<(value: T) => void>();

	const fn: Signal<T> = (() => value) as Signal<T>;

	fn.set = (next: T) => {
		if (Object.is(value, next)) return;
		value = next;
		subs.forEach((cb) => cb(value));
	};
	fn.update = (mut: (v: T) => T) => fn.set(mut(value));
	fn.subscribe = (cb) => {
		subs.add(cb);
		return () => { subs.delete(cb); };
	};

	return fn;
}

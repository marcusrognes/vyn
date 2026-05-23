// Thin DOM helpers. $/$$ for selecting, on() for event delegation.

export function $<E extends Element = HTMLElement>(selector: string, root: ParentNode = document): E {
	const el = root.querySelector<E>(selector);
	if (!el) throw new Error(`element not found: ${selector}`);
	return el;
}

export function $$<E extends Element = HTMLElement>(selector: string, root: ParentNode = document): E[] {
	return [...root.querySelectorAll<E>(selector)];
}

export function on<K extends keyof HTMLElementEventMap>(
	root: Element,
	type: K,
	selector: string,
	handler: (event: HTMLElementEventMap[K], target: HTMLElement) => void,
): () => void {
	const listener = (event: Event) => {
		const target = (event.target as HTMLElement).closest<HTMLElement>(selector);
		if (target && root.contains(target)) handler(event as HTMLElementEventMap[K], target);
	};
	root.addEventListener(type, listener);
	return () => root.removeEventListener(type, listener);
}

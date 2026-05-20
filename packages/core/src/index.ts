// @vyn/core public API. Implementation lands per the contracts the
// test suite enforces. Every export here is a stub until then;
// `npm test` runs the contracts as failing tests and turns them green
// as the implementation is written.

export function createQuery(_opts: unknown): never {
	throw new Error("@vyn/core: createQuery not implemented");
}

export function createMutation(_opts: unknown): never {
	throw new Error("@vyn/core: createMutation not implemented");
}

export function createSubscription(_opts: unknown): never {
	throw new Error("@vyn/core: createSubscription not implemented");
}

export const v = new Proxy({} as Record<string, unknown>, {
	get() {
		throw new Error("@vyn/core: v.* validators not implemented");
	},
});

export class RpcError extends Error {
	category: string;
	details?: unknown;
	constructor(category: string, message: string, details?: unknown) {
		super(message);
		this.category = category;
		this.details = details;
		this.name = "RpcError";
	}
}

export const registry = new Proxy({} as Record<string, unknown>, {
	get() {
		throw new Error("@vyn/core: registry not implemented");
	},
});

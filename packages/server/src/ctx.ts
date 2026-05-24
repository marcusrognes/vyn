// Three-layer ctx: framework BaseCtx (req/signal/setHeader/setCookie/
// setStatus/bus), app-provided staticCtx (boot-time), and per-request
// dynamicCtx (createContext result). Merged with strict precedence:
// { ...staticCtx, ...dynamicCtx, ...baseCtx }.
//
// The BaseCtx always wins because the framework-managed fields
// (`req`, response controls) must not be overridden.

export type BaseCtx = {
	req: Request;
	signal: AbortSignal;
	setStatus: (code: number) => void;
	setHeader: (name: string, value: string) => void;
	setCookie: (name: string, value: string, opts?: CookieOpts) => void;
	bus: EventBus;
};

export type CookieOpts = {
	domain?: string;
	path?: string;
	expires?: Date;
	maxAge?: number;
	sameSite?: "lax" | "strict" | "none";
	secure?: boolean;
	httpOnly?: boolean;
};

// Simple in-process bus. Replace with the pluggable Transport for
// multi-process deployments.
export class EventBus {
	private listeners = new Map<string, Set<(value: unknown) => void>>();

	publish(name: string, value: unknown) {
		this.listeners.get(name)?.forEach((fn) => fn(value));
	}

	subscribe(name: string, handler: (value: unknown) => void): () => void {
		let set = this.listeners.get(name);
		if (!set) {
			set = new Set();
			this.listeners.set(name, set);
		}
		set.add(handler);
		return () => {
			set!.delete(handler);
		};
	}
}

export function mergeCtx<S extends object, D extends object>(
	staticCtx: S,
	dynamicCtx: D,
	baseCtx: BaseCtx,
): S & D & BaseCtx {
	return { ...staticCtx, ...dynamicCtx, ...baseCtx } as S & D & BaseCtx;
}

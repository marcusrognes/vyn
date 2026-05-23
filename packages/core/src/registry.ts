// In-process registry of every action declared by the app.
// Surfaces (RPC, MCP, agent, CLI) read from this; nothing else
// privileged.

import type { Schema } from "./v.ts";

export type ActionKind = "query" | "mutation" | "subscription" | "job" | "notification";

export type ToolSpec = {
	description?: string;
	examples?:    Array<{ input: unknown; output?: unknown }>;
	category?:    string;
	dangerous?:   boolean;
	hidden?:      boolean;
};

export type Action = {
	kind:        ActionKind;
	name:        string;
	description?: string;
	input?:      Schema<unknown>;
	output?:     Schema<unknown>;
	tool?:       ToolSpec;
	// Each primitive adds its own fields; we keep this open.
	[k: string]: unknown;
};

type Listener = (action: Action) => void;

const actions = new Map<string, Action>();
const listeners = new Set<Listener>();

export type Registry = {
	register(action: Action): Action;
	list(): Action[];
	get(name: string): Action | undefined;
	byKind(kind: ActionKind): Action[];
	byTool(filter?: { category?: string }): Action[];
	schema(): Record<string, { input?: unknown; output?: unknown }>;
	onRegister(fn: Listener): () => boolean;
	clear(): void;
};

export const registry: Registry = {
	register(action: Action): Action {
		if (actions.has(action.name)) {
			throw new Error(`duplicate action name: ${action.name}`);
		}
		actions.set(action.name, action);
		listeners.forEach((fn) => fn(action));
		return action;
	},

	list(): Action[] {
		return [...actions.values()];
	},

	get(name: string): Action | undefined {
		return actions.get(name);
	},

	byKind(kind: ActionKind): Action[] {
		return [...actions.values()].filter((a) => a.kind === kind);
	},

	byTool(filter: { category?: string } = {}): Action[] {
		return [...actions.values()].filter((a) => {
			if (!a.tool) return false;
			if (filter.category && a.tool.category !== filter.category) return false;
			return true;
		});
	},

	schema(): Record<string, { input?: unknown; output?: unknown }> {
		const out: Record<string, { input?: unknown; output?: unknown }> = {};
		for (const a of actions.values()) {
			out[a.name] = {
				input:  a.input?.schema,
				output: a.output?.schema,
			};
		}
		return out;
	},

	onRegister(fn: Listener): () => boolean {
		listeners.add(fn);
		return () => listeners.delete(fn);
	},

	clear(): void {
		actions.clear();
	},
};

let anonCounter = 0;
export function anonymousName(prefix: string): string {
	return `${prefix}_anon_${++anonCounter}`;
}

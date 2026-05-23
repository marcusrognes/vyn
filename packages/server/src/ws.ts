// WebSocket subscription dispatch.
// Client connects to /ws, sends `{ id, action, input }`, server replies
// with frames `{ id, kind: 'value' | 'error' | 'end', payload? }` until
// the client closes or unsubscribes.

import { registry, RpcError, type Action } from "@vynjs/core";
import { type Transformer } from "./transformer.ts";
import type { BaseCtx } from "./ctx.ts";

export type WSContext = {
	transformer: Transformer;
	makeCtx:     (req: Request, baseCtx: BaseCtx) => Promise<object>;
};

type ClientFrame = {
	id:     string;
	action: string;
	input?: unknown;
	op?:    "subscribe" | "unsubscribe";
};

export function attachWebSocket(ws: WebSocket, req: Request, base: BaseCtx, surface: WSContext) {
	const subs = new Map<string, AbortController>();

	ws.addEventListener("message", async (event) => {
		let frame: ClientFrame;
		try {
			frame = JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data as ArrayBuffer));
		} catch {
			return ws.send(JSON.stringify({ id: null, kind: "error", error: { category: "bad_request", message: "invalid frame" } }));
		}

		if (frame.op === "unsubscribe") {
			subs.get(frame.id)?.abort();
			subs.delete(frame.id);
			return;
		}

		const action = registry.get(frame.action);
		if (!action || action.kind !== "subscription") {
			ws.send(JSON.stringify({ id: frame.id, kind: "error", error: { category: "not_found", message: `no such subscription: ${frame.action}` } }));
			return;
		}

		const ctrl = new AbortController();
		subs.set(frame.id, ctrl);

		const ctxExtra = await surface.makeCtx(req, base);
		const ctx = { ...ctxExtra, ...base };

		try {
			const input = frame.input !== undefined ? surface.transformer.deserialize(frame.input) : undefined;
			const iter  = (action as any).run({ input, ctx, signal: ctrl.signal });
			for await (const value of iter) {
				if (ctrl.signal.aborted) break;
				ws.send(JSON.stringify({ id: frame.id, kind: "value", payload: surface.transformer.serialize(value) }));
			}
			ws.send(JSON.stringify({ id: frame.id, kind: "end" }));
		} catch (e) {
			const err = e instanceof RpcError ? e.toJSON() : { category: "internal", message: (e as Error).message };
			ws.send(JSON.stringify({ id: frame.id, kind: "error", error: err }));
		} finally {
			subs.delete(frame.id);
		}
	});

	ws.addEventListener("close", () => {
		for (const ctrl of subs.values()) ctrl.abort();
		subs.clear();
	});
}

export type { Action };

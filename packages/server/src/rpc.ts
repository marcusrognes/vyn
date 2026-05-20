// RPC dispatcher. POST /rpc/<action.name> with JSON body invokes the
// matching action and returns the result via the transformer.
// Streaming queries/mutations (opts.tick) use Server-Sent Events.
// Subscriptions use WebSocket.

import { registry, RpcError, categoryToStatus, type Action } from "@vyn/core";
import { type Transformer } from "./transformer.ts";
import type { BaseCtx } from "./ctx.ts";

export type Surface = {
	transformer: Transformer;
	makeCtx:     (req: Request, baseCtx: BaseCtx) => Promise<object>;
};

export async function handleRpc(req: Request, base: BaseCtx, makeCtx: Surface["makeCtx"], transformer: Transformer): Promise<Response> {
	const url = new URL(req.url);
	const m = url.pathname.match(/^\/rpc\/(.+)$/);
	if (!m) return new Response("not found", { status: 404 });

	const actionName = m[1];
	const action = registry.get(actionName);
	if (!action) {
		return jsonError(new RpcError("not_found", `no such action: ${actionName}`), transformer);
	}

	if (action.kind === "subscription") {
		return new Response("subscriptions use websocket /ws", { status: 400 });
	}

	let body: unknown;
	try {
		const text = await req.text();
		body = text ? transformer.deserialize(JSON.parse(text)) : undefined;
	} catch (e) {
		return jsonError(new RpcError("bad_request", `invalid JSON body: ${(e as Error).message}`), transformer);
	}

	const ctxExtra = await makeCtx(req, base);
	const ctx = { ...ctxExtra, ...base };

	const input = (body as any)?.input;
	const isStream = req.headers.get("accept") === "text/event-stream";

	if (isStream && (action.kind === "query" || action.kind === "mutation" || action.kind === "job")) {
		return runStreaming(action, input, ctx, base, transformer);
	}

	try {
		const result = await (action as any).run({ input, ctx });
		const payload = result === undefined ? null : transformer.serialize(result);
		return new Response(JSON.stringify({ ok: true, result: payload }), {
			status:  200,
			headers: { "content-type": "application/json" },
		});
	} catch (e) {
		return jsonError(e, transformer);
	}
}

function runStreaming(action: Action, input: unknown, ctx: object, base: BaseCtx, transformer: Transformer): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(transformer.serialize(data))}\n\n`));
			};
			try {
				const result = await (action as any).run({
					input,
					ctx,
					tick: (payload: unknown) => send("tick", payload),
					signal: base.signal,
				});
				if (result !== undefined) send("result", result);
				else                       send("result", null);
				controller.close();
			} catch (e) {
				const err = e instanceof RpcError ? e : new RpcError("internal", (e as Error).message);
				send("error", err.toJSON());
				controller.close();
			}
		},
	});
	return new Response(stream, {
		status:  200,
		headers: {
			"content-type":  "text/event-stream",
			"cache-control": "no-cache",
			"connection":    "keep-alive",
		},
	});
}

function jsonError(error: unknown, transformer: Transformer): Response {
	if (error instanceof RpcError) {
		return new Response(JSON.stringify({ ok: false, error: error.toJSON() }), {
			status:  categoryToStatus(error.category),
			headers: { "content-type": "application/json" },
		});
	}
	const internal = new RpcError("internal", (error as Error).message ?? "internal error");
	return new Response(JSON.stringify({ ok: false, error: internal.toJSON() }), {
		status:  500,
		headers: { "content-type": "application/json" },
	});
}

export type { Action };

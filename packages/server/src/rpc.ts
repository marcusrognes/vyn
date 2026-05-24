// RPC dispatcher. POST /rpc/<action.name> with JSON body invokes the
// matching action and returns the result via the transformer.
// Streaming queries/mutations (opts.tick) use Server-Sent Events.
// Subscriptions use WebSocket.

import { type Action, categoryToStatus, registry, RpcError } from "@vynjs/core";
import { type Transformer } from "./transformer.ts";
import type { BaseCtx } from "./ctx.ts";

export type Surface = {
	transformer: Transformer;
	makeCtx: (req: Request, baseCtx: BaseCtx) => Promise<object>;
};

export async function handleRpc(
	req: Request,
	base: BaseCtx,
	makeCtx: Surface["makeCtx"],
	transformer: Transformer,
): Promise<Response> {
	const url = new URL(req.url);
	const m = url.pathname.match(/^\/rpc\/(.+)$/);
	if (!m) return new Response("not found", { status: 404 });

	const actionName = m[1];
	const action = registry.get(actionName);
	if (!action) {
		return jsonError(
			new RpcError("not_found", `no such action: ${actionName}`),
			transformer,
		);
	}

	if (action.kind === "subscription") {
		return new Response("subscriptions use websocket /ws", { status: 400 });
	}

	let rawInput: unknown;
	try {
		const text = await req.text();
		const body = text ? JSON.parse(text) : {};
		rawInput = body?.input;
	} catch (e) {
		return jsonError(
			new RpcError("bad_request", `invalid JSON body: ${(e as Error).message}`),
			transformer,
		);
	}

	const ctxExtra = await makeCtx(req, base);
	const ctx = { ...ctxExtra, ...base };

	const input = rawInput !== undefined ? transformer.deserialize(rawInput) : undefined;
	const isStream = req.headers.get("accept") === "text/event-stream";

	if (
		isStream &&
		(action.kind === "query" || action.kind === "mutation" ||
			action.kind === "job")
	) {
		return runStreaming(action, input, ctx, base, transformer);
	}

	try {
		const result = await (action as any).run({ input, ctx });
		const payload = result === undefined ? null : transformer.serialize(result);
		return new Response(JSON.stringify({ ok: true, result: payload }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	} catch (e) {
		return jsonError(e, transformer);
	}
}

function runStreaming(
	action: Action,
	input: unknown,
	ctx: object,
	base: BaseCtx,
	transformer: Transformer,
): Response {
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				controller.enqueue(
					encoder.encode(
						`event: ${event}\ndata: ${JSON.stringify(transformer.serialize(data))}\n\n`,
					),
				);
			};
			try {
				const result = await (action as any).run({
					input,
					ctx,
					tick: (payload: unknown) => send("tick", payload),
					signal: base.signal,
				});
				if (result !== undefined) send("result", result);
				else send("result", null);
				controller.close();
			} catch (e) {
				const err = toRpcError(e);
				send("error", err.toJSON());
				controller.close();
			}
		},
	});
	return new Response(stream, {
		status: 200,
		headers: {
			"content-type": "text/event-stream",
			"cache-control": "no-cache",
			"connection": "keep-alive",
		},
	});
}

function jsonError(error: unknown, _transformer: Transformer): Response {
	const mapped = toRpcError(error);
	return new Response(JSON.stringify({ ok: false, error: mapped.toJSON() }), {
		status: categoryToStatus(mapped.category),
		headers: { "content-type": "application/json" },
	});
}

// Map a thrown value to an RpcError. ValidationError (from @vynjs/core)
// becomes bad_request — the caller supplied bad input, not a server
// fault. Cross-package instanceof can lie under version skew, so match
// by error.name as well.
function toRpcError(error: unknown): RpcError {
	if (error instanceof RpcError) return error;
	const e = error as Error & { name?: string; issues?: unknown };
	if (e && (e.name === "ValidationError" || Array.isArray(e.issues))) {
		const err = new RpcError(
			"bad_request",
			e.message ?? "validation failed",
			e.issues,
		);
		return err;
	}
	return new RpcError("internal", e?.message ?? "internal error");
}

export type { Action };

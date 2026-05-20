// Minimal Model Context Protocol surface. Exposes every action with
// a `tool` field over JSON-RPC 2.0 at /mcp. Supports two methods:
//   tools/list  → { tools: [{ name, description, inputSchema }] }
//   tools/call  → invokes the matching action and returns its result
//
// This is enough for Claude Desktop / Inspector / agent runners that
// speak the basic MCP shape; richer features (resources, prompts,
// streaming) are deferred.

import { registry, type Action } from "@vyn/core";
import type { BaseCtx } from "./ctx.ts";

export type McpRequest = {
	jsonrpc: "2.0";
	id?:     string | number;
	method:  string;
	params?: Record<string, unknown>;
};

export type McpResponse =
	| { jsonrpc: "2.0"; id: string | number | undefined; result: unknown }
	| { jsonrpc: "2.0"; id: string | number | undefined; error:  { code: number; message: string; data?: unknown } };

function toolSpec(action: Action) {
	return {
		name:         action.name,
		description:  action.description ?? "",
		inputSchema:  action.input?.schema ?? { type: "object" },
		outputSchema: action.output?.schema ?? { type: "null" },
		annotations:  action.tool ?? {},
	};
}

export async function handleMcp(req: Request, makeCtx: () => Promise<object>): Promise<Response> {
	if (req.method !== "POST") {
		return new Response("mcp endpoint accepts POST only", { status: 405 });
	}

	let body: McpRequest;
	try { body = await req.json(); }
	catch { return jsonRpc(null, { code: -32700, message: "Parse error" }); }

	const id = body.id;

	try {
		if (body.method === "tools/list") {
			const tools = registry.list().filter((a) => a.tool && !a.tool.hidden).map(toolSpec);
			return jsonRpc(id, undefined, { tools });
		}

		if (body.method === "tools/call") {
			const { name, arguments: args } = (body.params ?? {}) as { name?: string; arguments?: unknown };
			if (!name) return jsonRpc(id, { code: -32602, message: "missing tool name" });
			const action = registry.get(name);
			if (!action || !action.tool) return jsonRpc(id, { code: -32601, message: `unknown tool: ${name}` });
			if (action.kind === "subscription") {
				return jsonRpc(id, { code: -32601, message: "subscriptions not callable via tools/call" });
			}
			const ctx    = await makeCtx();
			const result = await (action as any).run({ input: args, ctx });
			return jsonRpc(id, undefined, {
				content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
				structuredContent: result,
			});
		}

		if (body.method === "initialize") {
			return jsonRpc(id, undefined, {
				protocolVersion: "2024-11-05",
				capabilities:    { tools: {} },
				serverInfo:      { name: "@vyn/server", version: "0.0.0" },
			});
		}

		return jsonRpc(id, { code: -32601, message: `unknown method: ${body.method}` });
	} catch (e) {
		return jsonRpc(id, { code: -32603, message: (e as Error).message });
	}
}

function jsonRpc(id: string | number | null | undefined, error: { code: number; message: string; data?: unknown } | undefined, result?: unknown): Response {
	const payload: McpResponse = error
		? { jsonrpc: "2.0", id: id ?? undefined, error }
		: { jsonrpc: "2.0", id: id ?? undefined, result };
	return new Response(JSON.stringify(payload), {
		status:  error ? (error.code === -32700 ? 400 : 200) : 200,
		headers: { "content-type": "application/json" },
	});
}

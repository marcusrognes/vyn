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

// Queries with `tool: {}` AND zero required input fields can also be
// exposed as MCP resources — a snapshot read with no args. Apps that
// want richer resource semantics (URIs, content types) declare them
// in `action.tool.resource = { uri, mimeType }`.
function resourceSpec(action: Action) {
	const res = (action.tool as { resource?: { uri?: string; mimeType?: string } } | undefined)?.resource;
	const uri = res?.uri ?? `vyn://${action.name}`;
	return {
		uri,
		name:         action.name,
		description:  action.description ?? "",
		mimeType:     res?.mimeType ?? "application/json",
	};
}

function promptSpec(action: Action) {
	const args = action.input?.schema as { properties?: Record<string, { description?: string }> } | undefined;
	return {
		name:        action.name,
		description: action.description ?? "",
		arguments:   args?.properties
			? Object.entries(args.properties).map(([name, def]) => ({
				name,
				description: def.description ?? "",
				required:    true,
			}))
			: [],
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

		if (body.method === "resources/list") {
			const resources = registry.list()
				.filter((a) => a.kind === "query" && a.tool && !a.tool.hidden)
				.map(resourceSpec);
			return jsonRpc(id, undefined, { resources });
		}

		if (body.method === "resources/read") {
			const { uri } = (body.params ?? {}) as { uri?: string };
			if (!uri) return jsonRpc(id, { code: -32602, message: "missing uri" });
			const name = uri.replace(/^vyn:\/\//, "");
			const action = registry.get(name);
			if (!action || action.kind !== "query") return jsonRpc(id, { code: -32601, message: `unknown resource: ${uri}` });
			const ctx    = await makeCtx();
			const result = await (action as any).run({ input: {}, ctx });
			return jsonRpc(id, undefined, {
				contents: [{ uri, mimeType: "application/json", text: JSON.stringify(result) }],
			});
		}

		if (body.method === "prompts/list") {
			const prompts = registry.list()
				.filter((a) => (a.tool as { prompt?: boolean } | undefined)?.prompt === true)
				.map(promptSpec);
			return jsonRpc(id, undefined, { prompts });
		}

		if (body.method === "prompts/get") {
			const { name, arguments: args } = (body.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
			if (!name) return jsonRpc(id, { code: -32602, message: "missing prompt name" });
			const action = registry.get(name);
			if (!action || (action.tool as { prompt?: boolean } | undefined)?.prompt !== true) {
				return jsonRpc(id, { code: -32601, message: `unknown prompt: ${name}` });
			}
			const ctx    = await makeCtx();
			const result = await (action as any).run({ input: args ?? {}, ctx });
			const text   = typeof result === "string" ? result : JSON.stringify(result, null, 2);
			return jsonRpc(id, undefined, {
				description: action.description ?? "",
				messages: [{ role: "user", content: { type: "text", text } }],
			});
		}

		if (body.method === "initialize") {
			return jsonRpc(id, undefined, {
				protocolVersion: "2024-11-05",
				capabilities:    { tools: {}, resources: {}, prompts: {} },
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

import { describe, it } from "vitest";

// Contracts to implement (one test file each, mirroring the docs).
// This file stubs the index so CI surfaces what's missing.

describe.todo("env parsing — boot fails fast on missing required vars", () => {
	// /guide/configuration/#environment-variables
});

describe.todo("staticContext — runs once at boot, awaited before serve binds the port");
describe.todo("createContext — runs per request, receives { req, setCookie, setHeader, setStatus, staticCtx }");
describe.todo("BaseCtx — req, signal, setCookie, setHeader, setStatus, bus on every action");
describe.todo("ctx merge precedence — { ...staticCtx, ...dynamicCtx, ...baseCtx }");

describe.todo("transformer — input/output go through serialize/deserialize on the wire");
describe.todo("transformer — MCP tool inputs/outputs honored");
describe.todo("transformer — validation errors skip the transformer (raw JSON)");

describe.todo("RPC HTTP — POST /rpc/<action-name> with JSON body invokes the action");
describe.todo("RPC HTTP — RpcError category maps to HTTP status per /guide/errors/");
describe.todo("RPC HTTP — output validates against schema in dev mode, strips in prod");
describe.todo("RPC WS — subscription.listen opens a channel that streams yields");
describe.todo("RPC WS — opts.signal fires on client disconnect");

describe.todo("Transport — in-memory transport delivers emit() to local subscriptions");
describe.todo("Transport — interface contract { publish, subscribe, close? }");
describe.todo("Transport — subscription name is the dot-separated registry key");

describe.todo("MCP server — mounts at /mcp when mcp:true on serve config");
describe.todo("MCP server — exposes actions with tool field");
describe.todo("MCP stdio — vyn mcp --stdio boots without binding HTTP");

describe.todo("File-based discovery — *.actions.ts under actionsRoot becomes the registry");
describe.todo("File-based discovery — _ prefix files under public/routes/ are not routes");
describe.todo("File-based discovery — duplicate paths fail codegen");

describe.todo("Codegen — _vyn.gen.ts emitted with action barrel + AppRouter type + route params");

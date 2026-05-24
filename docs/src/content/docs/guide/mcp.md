---
title: MCP server
description: Expose actions as Model Context Protocol tools. Mounted on the same HTTP server as your RPC API.
sidebar:
    order: 7
---

:::caution Page coming. The shape is settled — see [Actions: the `tool` field](/vyn/guide/actions/#tool-llm-surfaces). This page will cover
transport options, authentication, MCP client setup, and tool filtering in detail. :::

## Quick orientation

The MCP server reads the action registry and exposes every action with a `tool` field as a Model Context Protocol tool. It runs **inside
your main Vyn server**, alongside the RPC API. One process, one port, one deploy.

```ts
// server.ts
import { serve } from "@vynjs/server";
import "./_vyn.gen.ts";

serve({
	port: 8000,
	mcp: true, // mount MCP at the default path (/mcp)
	// or, with overrides:
	// mcp: { path: "/mcp", auth: "session" },
});
```

That's the whole setup. The MCP endpoint is now reachable at `http://localhost:8000/mcp`, sharing the same process, database connection,
session store, and context factory as `/rpc`.

## Why side-by-side, not a separate process

Vyn deliberately mounts MCP next to RPC rather than running it as a sidecar. This keeps the operational model simple and makes both surfaces
consume the same data:

- **One ctx, no drift.** Whatever your `createContext` builds for an RPC request, MCP gets too. No second auth wiring, no duplicated
  database pool.
- **One deploy artifact.** Container, systemd unit, Deno Deploy region — whatever you ship, it speaks both protocols.
- **Tools mirror the typed RPC API.** Same registry, same filtering rules. If an action moves to a new file, both surfaces follow.
- **Cross-call is trivial.** Actions called via MCP can themselves call other actions, just like any RPC handler. No HTTP hop.

## Transports

Two transports cover the common cases:

### HTTP (the default)

When `mcp: true` (or `mcp: { ... }`), the MCP HTTP transport mounts on the main server. This is what remote MCP clients use — IDE plugins,
hosted agents, anything that can hit a URL.

Auth uses your existing session story by default. Override with `mcp.auth: "token"` to require a bearer token instead, or `mcp.auth: false`
for unauthenticated dev use.

### Stdio (for local clients)

For Claude Desktop and other local-only MCP clients that expect a subprocess speaking MCP over stdin/stdout, run:

```sh
vyn mcp --stdio
```

This boots the same app, registers the same actions, and uses the stdio transport instead of HTTP. The HTTP server does not start in this
mode. Use it from a `claude_desktop_config.json` entry that names your app's binary.

## What lands here when finished

- The full `serve({ mcp: ... })` config surface (path, auth, allow-list)
- Worked example wiring Claude Desktop to a stdio-mode Vyn binary
- Authentication strategies (session cookie, bearer token, OAuth)
- Filtering which actions become tools (`category`, `hidden`)
- Handling `tool.dangerous` from the MCP client's perspective
- Tool examples and how the LLM consumes them
- Versioning the MCP surface across releases

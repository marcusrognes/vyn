---
title: Errors
description: How actions signal failure and how each surface translates that signal into its own protocol.
sidebar:
  order: 7
---

Actions fail by throwing. There is exactly one error type the framework
treats specially — `RpcError` — and the surface (RPC, agent tool call,
MCP, CLI) decides how to render it for the caller. Everything else
that throws is treated as an internal error.

Errors are honest data: a category, a message, and an optional payload.
Surfaces map the category to whatever their protocol calls "this kind
of failure."

## The shape

```ts
import { RpcError } from "@vyn/core";

throw new RpcError("forbidden", "not your note");
throw new RpcError("conflict", "email already in use", { field: "email" });
```

| Field | Type | Meaning |
|---|---|---|
| `category` | `ErrorCategory` (string union) | What kind of failure this is |
| `message`  | `string`                       | Human-readable; surfaced to the caller |
| `details`  | `unknown` (optional)           | Structured payload — field names, retry hints, anything serializable |

`RpcError` extends `Error`, so `instanceof RpcError` works and
`.stack` is populated.

## Categories

Every category is a small, stable string. Use them — don't invent your
own. Surfaces only know how to translate this list.

| Category | RPC HTTP | Agent surface | MCP | CLI |
|---|---|---|---|---|
| `unauthorized` | 401 | tool error, "auth required" | protocol error | exit 2 |
| `forbidden`    | 403 | tool error, "not allowed"   | protocol error | exit 2 |
| `not_found`    | 404 | tool error, "not found"     | protocol error | exit 3 |
| `conflict`     | 409 | tool error, "conflict"      | protocol error | exit 4 |
| `bad_request`  | 400 | tool error, "bad input"     | protocol error | exit 5 |
| `rate_limited` | 429 | tool error, "rate limited"  | protocol error | exit 6 |
| `internal`     | 500 | tool error, "internal"      | protocol error | exit 1 |

The first six are caller-fixable: the user, agent, or script can
react to them and retry differently. `internal` is the catch-all for
"the action itself failed in a way the caller can't help with."

Pick the category that matches what *the caller can do about it*:

- A guard rejecting the request → `unauthorized` or `forbidden`
- A resource the caller pointed at doesn't exist → `not_found`
- A precondition failure (unique constraint, optimistic lock) → `conflict`
- Input that passed schema validation but violates business rules →
  `bad_request`
- Quota exhausted, retry after a delay → `rate_limited`
- Unexpected exception, bug, downstream service failure → `internal`

## What surfaces see

### RPC client

The typed client surfaces `RpcError` as a thrown error you can `catch`:

```ts
try {
	await rpc.notes.create.mutate({ body: "..." });
} catch (e) {
	if (e instanceof RpcError) {
		if (e.category === "unauthorized") location.href = "/login/";
		if (e.category === "conflict")     showFieldError(e.details);
	} else {
		throw e;   // unknown error; let it propagate
	}
}
```

`RpcError` is exported from `@vyn/client` too, with the same shape.
The wire format preserves the category, the message, and the details
verbatim.

### MCP server

`RpcError` becomes an MCP tool error with the category in the error
payload. The model sees something like:

```json
{ "is_error": true, "category": "forbidden", "message": "not your note" }
```

Models tend to react reasonably to this: a `forbidden` doesn't get
retried with the same input; a `rate_limited` waits; a `not_found`
tries something else.

### Agent surface

Same shape as MCP. The in-process agent passes the category through
unmodified to the model. `tool.dangerous` mutations are gated before
they run, so authorization failures usually surface here as
`unauthorized` / `forbidden` from the guard.

### CLI

The CLI prints the message and exits with a category-specific code
(see table). For `--json` output the full error including details is
emitted as JSON; for human output, the message and category are
printed on stderr.

## Errors that aren't `RpcError`

If something inside `run` throws an arbitrary `Error` (`TypeError`,
`SyntaxError`, a database driver exception), the framework treats it
as `internal`. The original message is preserved in the server log
with a stack trace; the client sees a generic "internal error" by
default.

This is intentional. Random exception messages can leak schema names,
file paths, or query fragments. The default is conservative; if you
want to surface a specific message to the caller, throw `RpcError`
yourself:

```ts
try {
	return JSON.parse(opts.input.text);
} catch {
	throw new RpcError("bad_request", "input.text is not valid JSON");
}
```

In development mode, the framework includes the original message and
stack in the response for ergonomics. Production strips them.

## Validation errors

Input validation runs *before* `run`. A schema mismatch never reaches
your code — the framework catches it and returns a `bad_request` with
the field path and the validator's reason:

```json
{
	"category": "bad_request",
	"message": "validation failed",
	"details": {
		"issues": [
			{ "path": ["email"], "kind": "format", "expected": "email" }
		]
	}
}
```

You don't catch and rethrow these. They are surfaced as `bad_request`
to every caller (RPC, agent, MCP, CLI) consistently. Forms can render
field errors from `details.issues[].path`; agents can revise the
input and retry; the CLI prints the path and the reason.

## Subscription errors

A subscription's async generator can also throw `RpcError`. The
event stream ends, the client receives the error in its `onError`
callback (or the async iterator throws), and the WS subscription is
torn down. Yielded values are still validated against `output`; a
validation failure here is a server bug and surfaces as `internal`.

```ts
export const onCreated = createSubscription({
	input: v.object({ projectId: v.string() }),
	output: NoteSchema,
	run: async function* (opts) {
		if (!opts.ctx.canAccessProject(opts.input.projectId)) {
			throw new RpcError("forbidden", "no access to project");
		}
		for await (const note of opts.ctx.bus.listen(/* ... */)) yield note;
	},
});
```

## Don't reinvent

Anti-patterns to avoid:

- **Returning `{ ok: false, error: ... }` from `run`.** Make `run`
  throw. The surface decides the envelope, not your handler.
- **Mapping HTTP status codes to special return values.** The category
  table above is the contract. If you want to "return 422," pick the
  closest category and put structured detail in `details`.
- **Custom error subclasses with framework meaning.** The framework
  only knows `RpcError`. App-side error subclasses that bubble up to
  `run` are treated as `internal`. If you want to give them meaning,
  catch and re-throw as `RpcError`.

The categories are deliberately a small fixed list. New ones happen on
a framework version bump, not per-app.

## See also

- [Actions](/vyn/guide/actions/) — `run` throws; surfaces render
- [Guards](/vyn/guide/guards/) — the common shape of `unauthorized` /
  `forbidden` failures
- [Configuration](/vyn/guide/configuration/) — production vs development
  error verbosity

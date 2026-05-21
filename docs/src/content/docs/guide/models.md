---
title: Models
description: Shared schemas for domain entities. Actions reference models; the framework derives types, forms, and tool specs.
sidebar:
  order: 2
---

A **model** in Vyn is a named, exported schema describing a domain entity:
a Note, a User, a Task. Models are built with the same `v.*` validators
as action `input`/`output`. There is no separate "model class" or ORM.

Models exist because actions need shared shape. The result type of
`note_get`, the result type of `note_create`, the row type the client
caches under `notes.*`, and the `Note` returned by `noteUpdate` are all
**the same** Note. Defining that shape once means a schema change ripples
through every action and surface automatically.

## Defining a model

A model is two exported bindings: the schema and the inferred type.
There is no wrapper around `v.object({...})`, no `defineModel` call.
Convention is to suffix the schema with `Schema` and give the inferred
type the clean name:

```ts
// features/notes/note.ts
import { v } from "@vyn/core";

export const NoteSchema = v.object({
	id: v.number(),
	title: v.string(),
	body: v.string(),
	createdAt: v.number(),
	updatedAt: v.number(),
});

export type Note = v.Infer<typeof NoteSchema>;
```

Use the inferred TypeScript type the same way you'd use any other type:

```ts
function isStale(note: Note): boolean {
	return Date.now() - note.updatedAt > 60_000;
}
```

### Why two names

TypeScript permits the same identifier in the value and type
namespaces, so a single `Note` (value) plus `type Note = ...` is
technically legal and compiles cleanly. We avoid it in Vyn docs because
the same name flips meaning depending on the context:

- `Note` at a value position is the schema (a runtime object).
- `Note` at a type position is the inferred shape (a compile-time type).

Newcomers reading the code have to context-switch to know which one
they're looking at. `NoteSchema` (value) + `Note` (type) keeps the two
distinct everywhere. Type positions — function parameters, return
types, generics — get the short name, which is the common case.

## Derivations

Most actions don't take or return the full model. Derive the shape you need
from the model itself — never restate it inline.

```ts
// pick a subset for input
export const NoteCreateSchema = NoteSchema.pick(["title", "body"]);
export type NoteCreate = v.Infer<typeof NoteCreateSchema>;

// allow optional updates
export const NotePatchSchema = NoteSchema.pick(["title", "body"]).partial();
export type NotePatch = v.Infer<typeof NotePatchSchema>;

// strip server-managed fields from agent-facing surfaces
export const NoteAgentSchema = NoteSchema.omit(["createdAt", "updatedAt"]);
export type NoteAgent = v.Infer<typeof NoteAgentSchema>;
```

`pick`, `omit`, `partial`, `extend`, and `merge` are the standard tools.
See the [v.\* reference](/vyn/api/core/#validators) for the full list.

## Constraints

Validators carry runtime constraints alongside their type. Constraints
attach to the leaf validator (`v.string()`, `v.number()`, `v.array(...)`)
and chain with the same fluent API as modifiers like `.optional` or
`.default`. Failed constraints throw a `ValidationError` with the offending
path and reason.

### Numbers

```ts
v.number().min(0)               // ≥ 0
v.number().max(100)             // ≤ 100
v.number().min(0).max(100)      // 0..100 inclusive
v.number().integer()            // no fractional part
v.number().positive()           // > 0
v.number().negative()           // < 0
v.number().multipleOf(5)        // divisible by 5
v.number().finite()             // rejects Infinity, NaN
```

### Strings

```ts
v.string().min(1)               // length ≥ 1 (non-empty)
v.string().max(280)             // length ≤ 280
v.string().length(36)           // exact length
v.string().regex(/^[a-z]+$/)    // pattern match
v.string().email()              // RFC-5321-ish email
v.string().url()                // parseable as URL
v.string().uuid()               // canonical UUID format
v.string().startsWith("https://")
v.string().endsWith(".png")
v.string().trim()               // strip surrounding whitespace before validation
v.string().lowercase()          // require lowercase (or transform — see notes)
```

`.regex(re, message?)` accepts an optional human-readable message that
appears in the `ValidationError` instead of "regex mismatch".

### Arrays

```ts
v.array(v.string())             // any length
v.array(v.string()).min(1)      // at least 1 element
v.array(v.string()).max(10)
v.array(v.string()).length(3)   // exactly 3
v.array(v.string()).unique()    // all items distinct (deep equality)
```

### Composed example

```ts
export const UserSchema = v.object({
	_id:        v.string().uuid().default(() => uuid()),
	email:      v.string().email().trim().lowercase(),
	displayName: v.string().min(1).max(50).default("Anonymous"),
	age:        v.number().integer().min(13).max(120).optional(),
	avatarUrl:  v.string().url().nullable(),
	tags:       v.array(v.string().min(1)).max(20).default(() => []),
});

export type User = v.Infer<typeof UserSchema>;
```

### Constraints are data

Like everything else in `v.*`, constraints expose themselves as data:

```ts
UserSchema.fields.email.constraints;
// → [{ kind: "email" }, { kind: "trim" }, { kind: "lowercase" }]
```

This is what powers:

- generated forms (an `email` constraint hints at `<input type="email">`),
- the JSON Schema export (constraints map to `minLength`, `maxLength`,
  `pattern`, `format`),
- agent tool specs (the agent sees both the type and the rule),
- diff tools that detect breaking constraint changes between releases.

Every constraint you add is a contract every surface honors.

## Optional and nullable

Three modifiers control whether a field may be missing, null, or absent
on output. They compose:

```ts
v.string().optional()         // input: may be missing; output: string | undefined
v.string().nullable()         // input: may be null;    output: string | null
v.string().optional().nullable()
// input: may be missing or null; output: string | null | undefined
```

`optional` and `nullable` are about value presence. `default` (next
section) is about *filling* a missing value with something concrete. The
three are independent:

| Modifier | Input may be missing? | Output may be undefined? | Output may be null? |
|---|---|---|---|
| `v.string()`                       | no  | no  | no  |
| `v.string().optional()`            | yes | yes | no  |
| `v.string().nullable()`            | no  | no  | yes |
| `v.string().default("x")`          | yes | no  | no  |
| `v.string().optional().default("x")` | yes | no  | no  |

The last row is worth noting: `.default` always wins over `.optional` for
the output type. Once a default is declared, the output value is
guaranteed; the optional-ness only affects what the parser accepts on
input.

```ts
const NoteSchema = v.object({
	_id:        v.string().default(() => uuid()),
	title:      v.string().default("New note"),
	body:       v.string(),
	archivedAt: v.number().optional(),   // may genuinely be absent
	deletedAt:  v.number().nullable(),   // present but explicitly null when not deleted
});

type Note = v.Infer<typeof NoteSchema>;
// {
//   _id:        string;
//   title:      string;
//   body:       string;
//   archivedAt?: number | undefined;
//   deletedAt:  number | null;
// }
```

## Defaults

Any field can declare a default. Defaults apply when the field is missing
from input. The default value may be a literal or a function — a function
runs once per parse so each instance gets its own fresh value (timestamps,
UUIDs, defaults derived from other input).

```ts
import { v } from "@vyn/core";
import { uuid } from "@vyn/core/util";

export const NoteSchema = v.object({
	_id:       v.string().default(() => uuid()),
	title:     v.string().default("New note"),
	body:      v.string(),
	createdAt: v.number().default(() => Date.now()),
	updatedAt: v.number().default(() => Date.now()),
});

export type Note = v.Infer<typeof NoteSchema>;
```

Defaults are honored by every parse:

```ts
const note = NoteSchema.parse({ body: "hello" });
// → { _id: "f72…", title: "New note", body: "hello", createdAt: ..., updatedAt: ... }
```

A field with a default behaves like an optional input for the parser but
is always populated in the output. The inferred TypeScript type reflects
that: `body` is required on input *and* output, while `_id`, `title`, and
the timestamps are optional on input and required on output.

## Construction

Every object schema carries a small set of factory methods. They are
not class constructors — the returned values are plain objects.

```ts
NoteSchema.create(partial)            // construct: apply defaults, validate, return POJO
NoteSchema.empty()                    // return an instance built entirely from defaults
NoteSchema.update(existing, patch)    // shallow-merge patch onto existing, re-validate, return new POJO
NoteSchema.parse(input)               // strict parse; throws if a required, non-defaulted field is missing
```

`create` and `parse` produce structurally identical results — the same
defaults apply, the same validation runs. The split exists because the
call site reads differently. `parse` is for untrusted input (HTTP body, a
file you just read); `create` is for in-process construction (a handler
making a new note for the user). The intent in the code matches the
intent in the operation.

```ts
const draft = NoteSchema.create({ body: "hello" });
// → { _id: "f72…", title: "New note", body: "hello", createdAt: …, updatedAt: … }

const blank = NoteSchema.empty();
// → { _id: "9a8…", title: "New note", body: "",       createdAt: …, updatedAt: … }
//   (the schema must allow `body` to be `""`, or `body` must have its own default)

const edited = NoteSchema.update(draft, { title: "renamed" });
// → new object, draft is untouched
```

### The created object is just an object

`NoteSchema.create(...)` returns a plain TypeScript object whose static
type is `Note` (i.e. `v.Infer<typeof NoteSchema>`). There is no class
to instantiate, no prototype, no `instanceof` check. The schema is a
record describing a shape; the output is data conforming to that shape.
You can:

```ts
const note: Note = NoteSchema.create({ body: "hello" });

JSON.stringify(note);                            // round-trips
structuredClone(note);                           // clones cleanly
Object.assign({}, note);                         // copies as a plain object
({ ...note, title: "renamed" });                 // spread freely
```

Behavior never attaches to model instances. If you find yourself wanting
to add a method to a note, write an action that takes a `Note` as input
and returns the result — that's what the registry is for.

## Models are data

Like actions, models are first-class records. The framework can read them
without running them.

```ts
import { NoteSchema } from "../features/notes/note.ts";

NoteSchema.schema;     // → JSON Schema for the model
NoteSchema.fields;     // → { id: NumberSchema, title: StringSchema, ... }
```

This is what powers:

- **Generated forms** in admin UIs, derived from the input model of an action.
- **Agent tool specs**, derived from the input/output models of actions
  tagged for agent use.
- **OpenAPI export**, walking every action and emitting its input/output
  schemas as components.
- **Type-safe cache reads** on the client; the cache stores models, not
  strings.

You did not generate any of those. The schemas are data; tooling reads them.

## Discovery without a registry

There is no model registry to import from. Tooling that needs to walk
"every model" walks the action registry instead — every input and
output schema is reachable from there, and that set is exactly what
the running app actually uses.

If your tooling needs models keyed by a stable string name (admin UI
URLs, OpenAPI component identifiers), use the export name from the
import path. `features/notes/note.ts: Note` is identifier enough; the
codegen artifact `_vyn.gen.ts` already knows it.

## What models are not

Vyn models are not:

- ORM entities. They have no `.save()` method. They don't know about
  your database. They describe shape, not behavior.
- Database schema. You can derive a `CREATE TABLE` from a model, and a
  helper exists for SQLite (see [Database](/vyn/guide/database/), coming),
  but the model is not the source of truth for the column types — the
  database is.
- Class instances. Models are validator records that produce plain
  TypeScript objects. No prototypes, no methods.

If you want behavior attached to a domain concept, write an action that
takes the model as input. Behavior lives in the registry.

## See also

- [Actions](/vyn/guide/actions/) — how models are referenced by callable units
- [RPC](/vyn/guide/rpc/) — how the typed client uses model types end-to-end

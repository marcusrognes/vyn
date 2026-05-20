// Validator library. v.string(), v.object(...), constraints, defaults,
// JSON Schema export, factory methods. Each validator is a small object
// with a parse() method and chainable modifiers.
//
// Design notes:
// - Schemas are data. Methods like .min(), .default(), .pick() return
//   a *new* schema object — never mutate in place. Same chaining as
//   Zod / Valibot.
// - .parse(input) returns the parsed value or throws a ValidationError.
// - .schema exposes a JSON Schema fragment so external tooling
//   (OpenAPI export, agent tool specs) can read shape without
//   running the parser.
// - Object schemas carry .fields so callers can introspect per-field
//   constraints (drives form generation).

export type Constraint = { kind: string; [k: string]: unknown };

export type Schema<T> = {
	readonly kind: string;
	readonly schema: unknown;
	readonly constraints: Constraint[];

	parse(input: unknown): T;
	optional(): Schema<T | undefined>;
	nullable(): Schema<T | null>;
	default(value: T | (() => T)): Schema<T>;
};

export type ObjectSchema<S extends Record<string, Schema<unknown>>> = Schema<InferObject<S>> & {
	readonly fields: S;
	pick<K extends keyof S & string>(keys: K[]): ObjectSchema<Pick<S, K>>;
	omit<K extends keyof S & string>(keys: K[]): ObjectSchema<Omit<S, K>>;
	partial(): ObjectSchema<{ [K in keyof S]: ReturnType<S[K]["optional"]> }>;
	extend<E extends Record<string, Schema<unknown>>>(extra: E): ObjectSchema<S & E>;
	merge<O extends Record<string, Schema<unknown>>>(other: ObjectSchema<O>): ObjectSchema<S & O>;
	create(partial: Partial<InferObject<S>>): InferObject<S>;
	empty(): InferObject<S>;
	update(existing: InferObject<S>, patch: Partial<InferObject<S>>): InferObject<S>;
};

export type StringSchema = Schema<string> & {
	min(n: number, message?: string): StringSchema;
	max(n: number, message?: string): StringSchema;
	length(n: number, message?: string): StringSchema;
	regex(re: RegExp, message?: string): StringSchema;
	email(message?: string): StringSchema;
	url(message?: string): StringSchema;
	uuid(message?: string): StringSchema;
	startsWith(s: string, message?: string): StringSchema;
	endsWith(s: string, message?: string): StringSchema;
	trim(): StringSchema;
	lowercase(message?: string): StringSchema;
};

export type NumberSchema = Schema<number> & {
	min(n: number, message?: string): NumberSchema;
	max(n: number, message?: string): NumberSchema;
	integer(message?: string): NumberSchema;
	positive(message?: string): NumberSchema;
	negative(message?: string): NumberSchema;
	multipleOf(n: number, message?: string): NumberSchema;
	finite(message?: string): NumberSchema;
};

export type ArraySchema<T> = Schema<T[]> & {
	min(n: number, message?: string): ArraySchema<T>;
	max(n: number, message?: string): ArraySchema<T>;
	length(n: number, message?: string): ArraySchema<T>;
	unique(message?: string): ArraySchema<T>;
};

export type InferObject<S extends Record<string, Schema<unknown>>> = {
	[K in keyof S]: S[K] extends Schema<infer T> ? T : never;
};

export type Infer<S> = S extends Schema<infer T> ? T : never;

export class ValidationError extends Error {
	issues: { path: (string | number)[]; kind: string; expected?: string; message?: string }[];
	constructor(issues: ValidationError["issues"]) {
		super(`validation failed: ${issues.map((i) => `${i.path.join(".") || "<root>"} ${i.kind}`).join(", ")}`);
		this.issues = issues;
		this.name = "ValidationError";
	}
}

// ─── internal helpers ────────────────────────────────────────────────

function makeSchema<T>(opts: {
	kind: string;
	schema: unknown;
	constraints?: Constraint[];
	parse: (input: unknown, path: (string | number)[]) => T;
}): Schema<T> {
	const cons = opts.constraints ?? [];
	const self: Schema<T> = {
		kind:        opts.kind,
		schema:      opts.schema,
		constraints: cons,

		parse(input) {
			return opts.parse(input, []);
		},

		optional() {
			return makeOptional(self);
		},
		nullable() {
			return makeNullable(self);
		},
		default(value) {
			return makeDefault(self, value);
		},
	};
	return self;
}

function makeOptional<T>(inner: Schema<T>): Schema<T | undefined> {
	return makeSchema<T | undefined>({
		kind:        inner.kind + "?",
		schema:      inner.schema,
		constraints: [...inner.constraints, { kind: "optional" }],
		parse: (input) => {
			if (input === undefined) return undefined;
			return inner.parse(input);
		},
	});
}

function makeNullable<T>(inner: Schema<T>): Schema<T | null> {
	return makeSchema<T | null>({
		kind:        inner.kind + "|null",
		schema:      inner.schema,
		constraints: [...inner.constraints, { kind: "nullable" }],
		parse: (input) => {
			if (input === null) return null;
			return inner.parse(input);
		},
	});
}

function makeDefault<T>(inner: Schema<T>, value: T | (() => T)): Schema<T> {
	return makeSchema<T>({
		kind:        inner.kind,
		schema:      inner.schema,
		constraints: [...inner.constraints, { kind: "default" }],
		parse: (input) => {
			if (input === undefined) {
				return typeof value === "function" ? (value as () => T)() : value;
			}
			return inner.parse(input);
		},
	});
}

function fail(path: (string | number)[], kind: string, extra?: Partial<ValidationError["issues"][number]>): never {
	throw new ValidationError([{ path, kind, ...extra }]);
}

function chainable<S>(self: S, builder: () => S): S {
	// Return a new instance derived from self via builder; used by .min() / .max() etc.
	return builder();
}

// ─── strings ─────────────────────────────────────────────────────────

function string(): StringSchema {
	return buildString([]);
}

function buildString(constraints: Constraint[]): StringSchema {
	const base = makeSchema<string>({
		kind:        "string",
		schema:      { type: "string" },
		constraints,
		parse: (input, path) => {
			if (typeof input !== "string") fail(path, "string");
			let value = input;
			for (const c of constraints) {
				switch (c.kind) {
					case "min":        if (value.length < (c.value as number)) fail(path, "min", { expected: String(c.value) }); break;
					case "max":        if (value.length > (c.value as number)) fail(path, "max", { expected: String(c.value) }); break;
					case "length":     if (value.length !== (c.value as number)) fail(path, "length", { expected: String(c.value) }); break;
					case "regex":      if (!(c.re as RegExp).test(value)) fail(path, "regex"); break;
					case "email":      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(path, "email"); break;
					case "url":        try { new URL(value); } catch { fail(path, "url"); } break;
					case "uuid":       if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) fail(path, "uuid"); break;
					case "startsWith": if (!value.startsWith(c.value as string)) fail(path, "startsWith"); break;
					case "endsWith":   if (!value.endsWith(c.value as string)) fail(path, "endsWith"); break;
					case "trim":       value = value.trim(); break;
					case "lowercase":  if (value !== value.toLowerCase()) fail(path, "lowercase"); break;
				}
			}
			return value;
		},
	}) as StringSchema;

	const add = (c: Constraint) => buildString([...constraints, c]);

	base.min        = (n, message) => add({ kind: "min",        value: n, message });
	base.max        = (n, message) => add({ kind: "max",        value: n, message });
	base.length     = (n, message) => add({ kind: "length",     value: n, message });
	base.regex      = (re, message) => add({ kind: "regex",     re,       message });
	base.email      = (message) => add({ kind: "email",      message });
	base.url        = (message) => add({ kind: "url",        message });
	base.uuid       = (message) => add({ kind: "uuid",       message });
	base.startsWith = (s, message) => add({ kind: "startsWith", value: s, message });
	base.endsWith   = (s, message) => add({ kind: "endsWith",   value: s, message });
	base.trim       = () => add({ kind: "trim" });
	base.lowercase  = (message) => add({ kind: "lowercase", message });

	return base;
}

// ─── numbers ─────────────────────────────────────────────────────────

function number(): NumberSchema {
	return buildNumber([]);
}

function buildNumber(constraints: Constraint[]): NumberSchema {
	const base = makeSchema<number>({
		kind:        "number",
		schema:      { type: "number" },
		constraints,
		parse: (input, path) => {
			if (typeof input !== "number") fail(path, "number");
			const v = input;
			for (const c of constraints) {
				switch (c.kind) {
					case "min":        if (v < (c.value as number)) fail(path, "min"); break;
					case "max":        if (v > (c.value as number)) fail(path, "max"); break;
					case "integer":    if (!Number.isInteger(v)) fail(path, "integer"); break;
					case "positive":   if (v <= 0) fail(path, "positive"); break;
					case "negative":   if (v >= 0) fail(path, "negative"); break;
					case "multipleOf": if (v % (c.value as number) !== 0) fail(path, "multipleOf"); break;
					case "finite":     if (!Number.isFinite(v)) fail(path, "finite"); break;
				}
			}
			return v;
		},
	}) as NumberSchema;

	const add = (c: Constraint) => buildNumber([...constraints, c]);

	base.min        = (n) => add({ kind: "min", value: n });
	base.max        = (n) => add({ kind: "max", value: n });
	base.integer    = () => add({ kind: "integer" });
	base.positive   = () => add({ kind: "positive" });
	base.negative   = () => add({ kind: "negative" });
	base.multipleOf = (n) => add({ kind: "multipleOf", value: n });
	base.finite     = () => add({ kind: "finite" });

	return base;
}

// ─── primitives ──────────────────────────────────────────────────────

function boolean(): Schema<boolean> {
	return makeSchema<boolean>({
		kind:   "boolean",
		schema: { type: "boolean" },
		parse:  (input, path) => {
			if (typeof input !== "boolean") fail(path, "boolean");
			return input;
		},
	});
}

function date(): Schema<Date> {
	return makeSchema<Date>({
		kind:   "date",
		schema: { type: "string", format: "date-time" },
		parse:  (input, path) => {
			if (input instanceof Date) return input;
			if (typeof input === "string" || typeof input === "number") {
				const d = new Date(input);
				if (!isNaN(d.getTime())) return d;
			}
			fail(path, "date");
		},
	});
}

function any(): Schema<unknown> {
	return makeSchema<unknown>({
		kind:   "any",
		schema: {},
		parse:  (input) => input,
	});
}

function unknown(): Schema<unknown> {
	return any();
}

function literal<L extends string | number | boolean>(value: L): Schema<L> {
	return makeSchema<L>({
		kind:   "literal",
		schema: { const: value },
		parse:  (input, path) => {
			if (input !== value) fail(path, "literal");
			return input as L;
		},
	});
}

// ─── arrays ──────────────────────────────────────────────────────────

function array<T>(item: Schema<T>): ArraySchema<T> {
	return buildArray(item, []);
}

function buildArray<T>(item: Schema<T>, constraints: Constraint[]): ArraySchema<T> {
	const base = makeSchema<T[]>({
		kind:        "array",
		schema:      { type: "array", items: item.schema },
		constraints,
		parse: (input, path) => {
			if (!Array.isArray(input)) fail(path, "array");
			const parsed: T[] = [];
			for (let i = 0; i < input.length; i++) {
				parsed.push((item as any).parseAt ? (item as any).parseAt(input[i], [...path, i]) : item.parse(input[i]));
			}
			for (const c of constraints) {
				switch (c.kind) {
					case "min":    if (parsed.length < (c.value as number)) fail(path, "min"); break;
					case "max":    if (parsed.length > (c.value as number)) fail(path, "max"); break;
					case "length": if (parsed.length !== (c.value as number)) fail(path, "length"); break;
					case "unique": {
						const seen = new Set<string>();
						for (const v of parsed) {
							const k = JSON.stringify(v);
							if (seen.has(k)) fail(path, "unique");
							seen.add(k);
						}
						break;
					}
				}
			}
			return parsed;
		},
	}) as ArraySchema<T>;

	const add = (c: Constraint) => buildArray(item, [...constraints, c]);

	base.min    = (n) => add({ kind: "min",    value: n });
	base.max    = (n) => add({ kind: "max",    value: n });
	base.length = (n) => add({ kind: "length", value: n });
	base.unique = () => add({ kind: "unique" });

	return base;
}

// ─── objects ─────────────────────────────────────────────────────────

function object<S extends Record<string, Schema<unknown>>>(fields: S): ObjectSchema<S> {
	const schema = {
		type: "object",
		properties: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.schema])),
		required:   Object.entries(fields).filter(([, v]) => !v.constraints.some((c) => c.kind === "optional" || c.kind === "default")).map(([k]) => k),
	};

	const base: ObjectSchema<S> = {
		kind:        "object",
		schema,
		constraints: [],
		fields,

		parse(input) {
			if (typeof input !== "object" || input === null || Array.isArray(input)) fail([], "object");
			const out: Record<string, unknown> = {};
			const issues: ValidationError["issues"] = [];
			for (const [k, fieldSchema] of Object.entries(fields)) {
				try {
					out[k] = fieldSchema.parse((input as Record<string, unknown>)[k]);
				} catch (e) {
					if (e instanceof ValidationError) {
						issues.push(...e.issues.map((i) => ({ ...i, path: [k, ...i.path] })));
					} else {
						throw e;
					}
				}
			}
			if (issues.length) throw new ValidationError(issues);
			return out as InferObject<S>;
		},

		optional()  { return makeOptional(this) as Schema<InferObject<S> | undefined> as ObjectSchema<S>; },
		nullable()  { return makeNullable(this) as Schema<InferObject<S> | null> as ObjectSchema<S>; },
		default(v)  { return makeDefault(this as Schema<InferObject<S>>, v) as ObjectSchema<S>; },

		pick(keys) {
			const picked = Object.fromEntries(keys.map((k) => [k, fields[k]])) as Pick<S, typeof keys[number]>;
			return object(picked);
		},

		omit(keys) {
			const set    = new Set(keys);
			const picked = Object.fromEntries(Object.entries(fields).filter(([k]) => !set.has(k as any)));
			return object(picked as any);
		},

		partial() {
			const partialFields = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()]));
			return object(partialFields as any) as any;
		},

		extend(extra) {
			return object({ ...fields, ...extra });
		},

		merge(other) {
			return object({ ...fields, ...other.fields });
		},

		create(partial) {
			return this.parse({ ...(partial as object) }) as InferObject<S>;
		},

		empty() {
			return this.parse({}) as InferObject<S>;
		},

		update(existing, patch) {
			return this.parse({ ...(existing as object), ...(patch as object) }) as InferObject<S>;
		},
	};

	return base;
}

// ─── unions ──────────────────────────────────────────────────────────

function union<T extends Schema<unknown>[]>(...members: T): Schema<T[number] extends Schema<infer U> ? U : never> {
	type R = T[number] extends Schema<infer U> ? U : never;
	return makeSchema<R>({
		kind:   "union",
		schema: { oneOf: members.map((m) => m.schema) },
		parse:  (input, path) => {
			for (const m of members) {
				try { return m.parse(input) as R; }
				catch (_) { /* try next */ }
			}
			fail(path, "union");
		},
	});
}

// ─── record ──────────────────────────────────────────────────────────

function record<V>(_keySchema: Schema<string>, valueSchema: Schema<V>): Schema<Record<string, V>> {
	return makeSchema<Record<string, V>>({
		kind:   "record",
		schema: { type: "object", additionalProperties: valueSchema.schema },
		parse:  (input, path) => {
			if (typeof input !== "object" || input === null || Array.isArray(input)) fail(path, "record");
			const out: Record<string, V> = {};
			for (const [k, val] of Object.entries(input)) {
				out[k] = valueSchema.parse(val);
			}
			return out;
		},
	});
}

// ─── instance / map ──────────────────────────────────────────────────

function instanceOf<C extends new (...args: any[]) => any>(ctor: C): Schema<InstanceType<C>> {
	return makeSchema<InstanceType<C>>({
		kind:   "instanceOf",
		schema: { type: "object" }, // best-effort JSON Schema
		parse:  (input, path) => {
			if (!(input instanceof ctor)) fail(path, "instanceOf");
			return input as InstanceType<C>;
		},
	});
}

function map<K, V>(_keySchema: Schema<K>, _valueSchema: Schema<V>): Schema<Map<K, V>> {
	return makeSchema<Map<K, V>>({
		kind:   "map",
		schema: { type: "object" },
		parse:  (input, path) => {
			if (!(input instanceof Map)) fail(path, "map");
			return input as Map<K, V>;
		},
	});
}

// ─── public API ──────────────────────────────────────────────────────

export const v = {
	string,
	number,
	boolean,
	date,
	any,
	unknown,
	literal,
	array,
	object,
	union,
	record,
	instanceOf,
	map,
};

export type { Infer as VInfer };

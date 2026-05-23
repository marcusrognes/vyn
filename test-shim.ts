// Vitest-compatible shim backed by Deno std. Lets existing vitest tests
// run under `deno test`. Wire-up: deno.json imports map "vitest" → this file.
//
// Surface covered:
//   - describe / it / beforeEach / beforeAll / afterEach / afterAll (BDD)
//   - it.each / describe.each (vitest parameterized tests)
//   - expect from @std/expect (jest-compatible matcher set)
//
// Notes:
//   - `toThrowError` is not in @std/expect — use `toThrow` instead (test
//     files have been updated).

import {
	describe as _describe,
	it as _it,
	beforeEach,
	beforeAll,
	afterEach,
	afterAll,
} from "jsr:@std/testing@^1.0.0/bdd";
export { expect } from "jsr:@std/expect@^1.0.0";

type TestFn  = (...args: any[]) => any;
type EachRow = readonly unknown[] | Record<string, unknown> | unknown;

function format(template: string, row: EachRow): string {
	if (Array.isArray(row)) {
		let i = 0;
		return template.replace(/%[sdifjop%]/g, (m) => {
			if (m === "%%") return "%";
			const v = row[i++];
			return typeof v === "object" ? JSON.stringify(v) : String(v);
		});
	}
	if (row && typeof row === "object") {
		return template.replace(/\$([a-zA-Z_$][\w$]*)/g, (_m, k) => String((row as any)[k]));
	}
	return template.replace(/%[sdifjop%]/g, (m) => m === "%%" ? "%" : String(row));
}

function makeEach(base: (name: string, fn: TestFn) => void) {
	return function each<T extends EachRow>(rows: readonly T[]) {
		return (template: string, fn: (...args: unknown[]) => unknown) => {
			for (const row of rows) {
				const name = format(template, row as EachRow);
				if (Array.isArray(row)) {
					base(name, () => (fn as any)(...row));
				} else {
					base(name, () => (fn as any)(row));
				}
			}
		};
	};
}

// vitest exposes `.todo` (placeholder, name only) and `.skip` on it/describe.
// std/testing/bdd uses `.ignore` and requires a fn — supply a noop when only
// a name is passed.
function ignoreShim(base: (name: string, fn: TestFn) => void) {
	return (name: string, fn?: TestFn) => base(name, fn ?? (() => {}));
}

export const it = Object.assign(_it, {
	each: makeEach(_it as any),
	todo: ignoreShim((_it as any).ignore),
	skip: ignoreShim((_it as any).ignore),
});
export const describe = Object.assign(_describe, {
	each: makeEach(_describe as any),
	todo: ignoreShim((_describe as any).ignore),
	skip: ignoreShim((_describe as any).ignore),
});
export { beforeEach, beforeAll, afterEach, afterAll };

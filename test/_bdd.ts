// Vyn's tiny BDD wrapper around Deno std. Exposes the surface vyn tests use:
//   describe / it / beforeEach / beforeAll / afterEach / afterAll
//   it.each / describe.each  — parameterized tests
//   it.todo / it.skip        — pending / skipped tests (placeholder bodies OK)
//   expect                   — from @std/expect (jest-compatible)
//
// Imported from tests via the "vyn:test" alias in deno.json.

import { afterAll, afterEach, beforeAll, beforeEach, describe as _describe, it as _it } from "jsr:@std/testing@^1/bdd";
export { expect } from "jsr:@std/expect@^1";

type TestFn = (...args: any[]) => any;
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
		return template.replace(
			/\$([a-zA-Z_$][\w$]*)/g,
			(_m, k) => String((row as any)[k]),
		);
	}
	return template.replace(
		/%[sdifjop%]/g,
		(m) => m === "%%" ? "%" : String(row),
	);
}

function makeEach(base: (name: string, fn: TestFn) => void) {
	return function each<T extends EachRow>(rows: readonly T[]) {
		return (template: string, fn: (...args: unknown[]) => unknown) => {
			for (const row of rows) {
				const name = format(template, row as EachRow);
				if (Array.isArray(row)) base(name, () => (fn as any)(...row));
				else base(name, () => (fn as any)(row));
			}
		};
	};
}

function ignoreShim(base: (name: string, fn: TestFn) => void) {
	return (name: string, fn?: TestFn) => base(name, fn ?? (() => {}));
}

export { afterAll, afterEach, beforeAll, beforeEach };

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

// Cookie parsing + serialization. Plain functions, no external deps.

import type { CookieOpts } from "./ctx.ts";

export function parseCookies(header: string | null): Record<string, string> {
	const out: Record<string, string> = {};
	if (!header) return out;
	for (const part of header.split(/;\s*/)) {
		const eq = part.indexOf("=");
		if (eq < 0) continue;
		const name = part.slice(0, eq);
		const value = part.slice(eq + 1);
		out[name] = decodeURIComponent(value);
	}
	return out;
}

export function serializeCookie(
	name: string,
	value: string,
	opts: CookieOpts = {},
): string {
	const segments: string[] = [`${name}=${encodeURIComponent(value)}`];
	if (opts.domain) segments.push(`Domain=${opts.domain}`);
	if (opts.path) segments.push(`Path=${opts.path}`);
	if (opts.expires) segments.push(`Expires=${opts.expires.toUTCString()}`);
	if (opts.maxAge !== undefined) segments.push(`Max-Age=${opts.maxAge}`);
	if (opts.sameSite) {
		segments.push(
			`SameSite=${opts.sameSite[0].toUpperCase() + opts.sameSite.slice(1)}`,
		);
	}
	if (opts.secure) segments.push(`Secure`);
	if (opts.httpOnly) segments.push(`HttpOnly`);
	return segments.join("; ");
}

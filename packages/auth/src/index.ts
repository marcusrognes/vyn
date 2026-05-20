// Lightweight auth helpers. Password hashing via node:crypto's scrypt;
// random session tokens; pluggable SessionStore.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scryptAsync(password, salt, SCRYPT_KEYLEN);
	return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, hashHex] = stored.split(":");
	if (!saltHex || !hashHex) return false;
	const salt   = Buffer.from(saltHex, "hex");
	const expected = Buffer.from(hashHex, "hex");
	const actual   = await scryptAsync(password, salt, expected.length);
	if (actual.length !== expected.length) return false;
	return timingSafeEqual(actual, expected);
}

export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString("hex");
}

export type Session = {
	token:     string;
	userId:    string;
	expiresAt: Date;
};

export type SessionStore = {
	get(token: string): Promise<Session | undefined>;
	set(session: Session): Promise<void>;
	delete(token: string): Promise<void>;
};

export function createMemorySessionStore(): SessionStore {
	const store = new Map<string, Session>();
	return {
		async get(token) {
			const s = store.get(token);
			if (!s) return undefined;
			if (s.expiresAt.getTime() < Date.now()) { store.delete(token); return undefined; }
			return s;
		},
		async set(session)   { store.set(session.token, session); },
		async delete(token)  { store.delete(token); },
	};
}

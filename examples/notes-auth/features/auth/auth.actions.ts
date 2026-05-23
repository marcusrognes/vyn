import { createMutation, createQuery, v, RpcError } from "@vynjs/core";
import { hashPassword, verifyPassword, randomToken } from "@vynjs/auth";
import type { Ctx, User } from "../../ctx.ts";

const Credentials = v.object({
	email:    v.string().email(),
	password: v.string().min(8).max(200),
});

const UserPublicSchema = v.object({
	_id:       v.string().uuid(),
	email:     v.string().email(),
	createdAt: v.number(),
});

const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

export const signup = createMutation({
	name:        "auth.signup",
	description: "Create a new account and sign in.",
	input:       Credentials,
	output:      UserPublicSchema,
	run: async (opts: { input: { email: string; password: string }; ctx: Ctx }) => {
		for (const u of opts.ctx.users.values()) {
			if (u.email === opts.input.email) throw new RpcError("conflict", "email already in use");
		}
		const user: User = {
			_id:          crypto.randomUUID(),
			email:        opts.input.email,
			passwordHash: await hashPassword(opts.input.password),
			createdAt:    Date.now(),
		};
		opts.ctx.users.set(user._id, user);
		await issueSession(opts.ctx, user._id);
		return { _id: user._id, email: user.email, createdAt: user.createdAt };
	},
});

export const login = createMutation({
	name:        "auth.login",
	description: "Sign in to an existing account.",
	input:       Credentials,
	output:      UserPublicSchema,
	run: async (opts: { input: { email: string; password: string }; ctx: Ctx }) => {
		const user = [...opts.ctx.users.values()].find((u) => u.email === opts.input.email);
		if (!user || !(await verifyPassword(opts.input.password, user.passwordHash))) {
			throw new RpcError("unauthorized", "invalid email or password");
		}
		await issueSession(opts.ctx, user._id);
		return { _id: user._id, email: user.email, createdAt: user.createdAt };
	},
});

export const logout = createMutation({
	name:        "auth.logout",
	description: "Sign out the current user.",
	input:       v.object({}),
	run: async (opts: { input: {}; ctx: Ctx }) => {
		const cookieHeader = opts.ctx.req.headers.get("cookie") ?? "";
		const token = parseToken(cookieHeader);
		if (token) await opts.ctx.sessions.delete(token);
		opts.ctx.setCookie("session", "", { path: "/", maxAge: 0 });
	},
});

export const me = createQuery({
	name:        "auth.me",
	description: "Return the current user (or null if signed out).",
	input:       v.object({}),
	output:      UserPublicSchema.nullable(),
	run: async (opts: { input: {}; ctx: Ctx }) => {
		if (!opts.ctx.userId) return null;
		const user = opts.ctx.users.get(opts.ctx.userId);
		if (!user) return null;
		return { _id: user._id, email: user.email, createdAt: user.createdAt };
	},
});

async function issueSession(ctx: Ctx, userId: string) {
	const token = randomToken(32);
	const expiresAt = new Date(Date.now() + SESSION_TTL);
	await ctx.sessions.set({ token, userId, expiresAt });
	ctx.setCookie("session", token, {
		path:     "/",
		expires:  expiresAt,
		httpOnly: true,
		sameSite: "lax",
	});
}

function parseToken(cookieHeader: string): string | undefined {
	for (const part of cookieHeader.split(/;\s*/)) {
		const [k, v] = part.split("=");
		if (k === "session") return decodeURIComponent(v ?? "");
	}
}

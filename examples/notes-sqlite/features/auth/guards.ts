import { RpcError } from "@vyn/core";
import type { Ctx } from "../../ctx.ts";

export function requireSession(opts: { ctx: Ctx }): { userId: string } {
	if (!opts.ctx.userId) throw new RpcError("unauthorized", "sign in to continue");
	return { userId: opts.ctx.userId };
}

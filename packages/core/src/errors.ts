// RpcError — the framework's one categorized error. Every surface
// (HTTP, MCP, agent, CLI) knows how to translate the category set.

export type ErrorCategory =
	| "unauthorized"
	| "forbidden"
	| "not_found"
	| "conflict"
	| "bad_request"
	| "rate_limited"
	| "internal";

export class RpcError extends Error {
	category: ErrorCategory;
	details?: unknown;

	constructor(category: ErrorCategory, message: string, details?: unknown) {
		super(message);
		this.category = category;
		this.details  = details;
		this.name     = "RpcError";
	}

	toJSON() {
		return {
			category: this.category,
			message:  this.message,
			...(this.details !== undefined && { details: this.details }),
		};
	}
}

export function categoryToStatus(category: ErrorCategory): number {
	switch (category) {
		case "unauthorized": return 401;
		case "forbidden":    return 403;
		case "not_found":    return 404;
		case "conflict":     return 409;
		case "bad_request":  return 400;
		case "rate_limited": return 429;
		case "internal":     return 500;
	}
}

// Retry rule for jobs: caller-fixable errors are permanent;
// transient errors retry.
export function isPermanent(error: unknown): boolean {
	if (!(error instanceof RpcError)) return false;
	return error.category === "unauthorized"
		|| error.category === "forbidden"
		|| error.category === "not_found"
		|| error.category === "bad_request";
}

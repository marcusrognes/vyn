// @vyn/core public API.

export { v, ValidationError, type Schema, type ObjectSchema, type StringSchema, type NumberSchema, type ArraySchema, type Constraint, type VInfer } from "./v.ts";
export { RpcError, categoryToStatus, isPermanent, type ErrorCategory } from "./errors.ts";
export { registry, type Action, type ActionKind, type ToolSpec } from "./registry.ts";
export {
	createQuery,
	createMutation,
	createSubscription,
	createJob,
	createNotification,
	inboxAdapter,
	type RunOpts,
	type QueryAction,
	type MutationAction,
	type SubscriptionAction,
	type JobAction,
	type JobStatus,
	type JobWatchEvent,
	type NotificationAction,
	type BundleItem,
} from "./actions.ts";

// Re-export v.Infer alias as the canonical type helper.
export type { VInfer as Infer } from "./v.ts";

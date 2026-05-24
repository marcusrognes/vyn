// @vynjs/core public API.

export { v, ValidationError, type Schema, type ObjectSchema, type StringSchema, type NumberSchema, type ArraySchema, type Constraint, type VInfer } from "./v.ts";
export { RpcError, categoryToStatus, isPermanent, type ErrorCategory } from "./errors.ts";
export { registry, rebindActions, type Action, type ActionKind, type ToolSpec } from "./registry.ts";
export {
	createQuery,
	createMutation,
	createSubscription,
	createJob,
	createNotification,
	inboxAdapter,
	installBackgroundCtx,
	getBackgroundCtx,
	startCronJobs,
	stopCronJobs,
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

export { parseCron, previousTick, nextTick, type CronExpression } from "./cron.ts";
export {
	installNotify,
	shutdownNotify,
	flushNow,
	dispatchNotification,
	_resetNotifyRuntime,
	_getQueueSize,
	type NotificationAdapter,
	type PreferencesResolver,
	type ChannelPreference,
} from "./notify-runtime.ts";

// Re-export v.Infer alias as the canonical type helper.
export type { VInfer as Infer } from "./v.ts";

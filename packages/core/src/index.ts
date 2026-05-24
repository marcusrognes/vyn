// @vynjs/core public API.

export {
	type ArraySchema,
	type Constraint,
	type NumberSchema,
	type ObjectSchema,
	type Schema,
	type StringSchema,
	v,
	ValidationError,
	type VInfer,
} from "./v.ts";
export { categoryToStatus, type ErrorCategory, isPermanent, RpcError } from "./errors.ts";
export { type Action, type ActionKind, rebindActions, registry, type ToolSpec } from "./registry.ts";
export { installPublishHook, publishViaTransport, resetPublishHook } from "./transport.ts";
export {
	type BundleItem,
	createJob,
	createMutation,
	createNotification,
	createQuery,
	createSubscription,
	getBackgroundCtx,
	inboxAdapter,
	installBackgroundCtx,
	type JobAction,
	type JobStatus,
	type JobWatchEvent,
	type MutationAction,
	type NotificationAction,
	type QueryAction,
	type RunOpts,
	startCronJobs,
	stopCronJobs,
	type SubscriptionAction,
} from "./actions.ts";

export { type CronExpression, nextTick, parseCron, previousTick } from "./cron.ts";
export {
	_getQueueSize,
	_resetNotifyRuntime,
	type ChannelPreference,
	dispatchNotification,
	flushNow,
	installNotify,
	type NotificationAdapter,
	type PreferencesResolver,
	shutdownNotify,
} from "./notify-runtime.ts";

// Re-export v.Infer alias as the canonical type helper.
export type { VInfer as Infer } from "./v.ts";

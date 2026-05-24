// Publish-side hook for cross-process event delivery.
//
// createSubscription's emit() calls publishViaTransport(action.name, value)
// alongside the local queue push. If serve() has installed a hook (because
// an EventTransport was provided), the hook forwards to that transport.
// Otherwise the call is a no-op.
//
// Subscribe-side is handled by serve() — it walks the registry and
// dispatches incoming transport messages to each subscription's
// deliverLocal().

type PublishHook = (name: string, value: unknown) => void;

let hook: PublishHook | undefined;

export function installPublishHook(fn: PublishHook): void {
	hook = fn;
}

export function publishViaTransport(name: string, value: unknown): void {
	hook?.(name, value);
}

// Tests and tear-down paths use this to drop the hook between runs.
export function resetPublishHook(): void {
	hook = undefined;
}

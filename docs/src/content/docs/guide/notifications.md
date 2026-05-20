---
title: Notifications
description: Multi-channel notifications (email, push, in-app) as a fifth action primitive. Job-backed retries, per-channel render functions, pluggable adapters, per-user preferences.
sidebar:
  order: 9
---

A **notification** is a typed message delivered through one or more
channels — email, web push, in-app. `createNotification` is the
primitive; `.send(input)` dispatches it; the framework routes through
each configured channel, with per-channel templating and adapter
delivery.

Notifications are job-backed: each channel send becomes a retryable
job under the hood. Failures retry with the same backoff semantics
as [jobs](/guide/jobs/). The two primitives share enough that
`createNotification` is structurally a [`createJob`](/guide/jobs/)
specialization for the common "deliver this to a person through some
channel" pattern.

## A complete example

```ts
// features/notifications/welcome.actions.ts
import { createNotification, v } from "@vyn/core";

export const welcome = createNotification({
	description: "Welcome a newly-signed-up user.",
	input: v.object({ userId: v.string() }),
	channels: {
		email: async (opts) => {
			const user = await opts.ctx.db.users.get(opts.input.userId);
			return {
				to:      user.email,
				subject: "Welcome to Vyn",
				html:    `<h1>Hi ${user.displayName}!</h1><p>…</p>`,
				text:    `Hi ${user.displayName}! …`,
			};
		},
		push: async (opts) => ({
			title: "Welcome!",
			body:  "Your account is ready.",
			icon:  "/icons/welcome.png",
			data:  { userId: opts.input.userId },
		}),
		inApp: async (opts) => ({
			kind: "welcome",
			body: "Welcome to the app — start by creating your first note.",
		}),
	},
	retries: 3,
});
```

Send it from a mutation:

```ts
import { welcome } from "../notifications/welcome.actions.ts";

export const signup = createMutation({
	input: Credentials,
	output: UserPublicSchema,
	run: async (opts) => {
		const user = await createUser(opts);
		welcome.send({ userId: user._id });
		return UserPublicSchema.parse(user);
	},
});
```

What happens:

1. `welcome.send({ userId })` validates input, then enqueues one job
   per channel (`welcome.email`, `welcome.push`, `welcome.inApp`).
2. Workers pull each job. The matching channel render function runs,
   producing the channel's payload.
3. The channel adapter (Postmark, Web Push, an in-app subscription)
   delivers the payload.
4. On failure, the framework retries with backoff per the job semantics.

Each channel is independent — a push failure doesn't block the email.

## The primitive

The short form uses one render function per channel — every channel
sends instantly:

```ts
createNotification({
	description: "...",
	input: v.object({...}),
	channels: {
		email: async (opts) => ({ to, subject, html, text }),
		push:  async (opts) => ({ title, body, icon?, data? }),
		inApp: async (opts) => ({ kind, body }),
	},
	retries: 3,
});
```

The richer form picks **mode per channel** — same notification fires
instantly through push, batched into a daily digest email, and
deferred 30 minutes for an in-app reminder, all from one `.send()`:

```ts
createNotification({
	description: "Someone commented on your note.",
	input: v.object({ noteId: v.string(), commentId: v.string(), recipientId: v.string() }),

	channels: {
		push: {
			mode:   "instant",
			render: async (opts) => ({ title: "New comment", body: await preview(opts) }),
		},

		email: {
			mode:         "digest",
			digestKey:    (input) => input.recipientId,    // accumulate per user
			digestSchedule: { cron: "0 8 * * *" },         // flush daily at 08:00
			digestMaxAge:   "24h",                          // don't include items older than this
			renderItem:   async (opts) => ({ noteId: opts.input.noteId, commentId: opts.input.commentId }),
			renderDigest: async ({ items, ctx, userId }) => {
				const user = await ctx.db.users.get(userId);
				return {
					to:      user.email,
					subject: `${items.length} new comments`,
					html:    digestHtml(items),
				};
			},
		},

		inApp: {
			mode:   "deferred",
			delay:  30 * 60 * 1000,    // 30 minutes
			render: async (opts) => ({ kind: "comment", noteId: opts.input.noteId }),
		},
	},

	retries: 3,
});
```

One `.send()` call fans out to three channels with three different
delivery modes. The user gets the push immediately, a single email at
8am summarizing the day's comments, and an in-app reminder card 30
minutes after each event.

## Delivery modes

| Mode | Behavior |
|---|---|
| `instant` (default) | Render and dispatch via the adapter immediately. One adapter call per `.send()` |
| `deferred` | Enqueue a job that runs `delay` ms later (or at a specific time via `.at()`). Same render-and-dispatch shape; just time-shifted |
| `digest`  | Accumulate per `digestKey`; a scheduled flush job calls `renderDigest({ items, ctx, userId })` to produce one payload per group |

A channel using `digest` mode must declare:

- `digestKey(input)` — what to group by (usually `recipientId`)
- `digestSchedule` — how often the framework checks each pending
  group (cron or interval). NOT the time it actually fires
- `renderItem(opts)` — what to record per event (minimal — just
  enough to render the digest later)
- `renderDigest({ items, ctx, userId })` — what the combined message
  looks like

The framework keeps the digest queue in the job store. On each
`digestSchedule` pulse, it walks every pending group and asks: is
this group ready to flush? The default answer is "yes, every time"
— pulse interval = flush interval. For per-user timing, declare
`flushWhen`:

### `flushWhen` — per-user digest timing

`flushWhen({ userId, ctx, items, lastFlushAt })` returns `true` if
the framework should render and send the digest for this user now,
`false` to keep the items queued for the next pulse.

Use it when you want each user to control **when** they receive
their digest. The pulse stays fast (every 15 minutes, every hour);
the predicate reads the user's preference and gates delivery.

```ts
email: {
	mode:           "digest",
	digestKey:      (input) => input.userId,
	digestSchedule: { interval: "15 minutes" },   // tight pulse
	flushWhen: async ({ userId, ctx, lastFlushAt }) => {
		const user = await ctx.db.users.findOne({ _id: userId });
		const hour = user?.preferences?.digestHour ?? 8;
		const tz   = user?.preferences?.timezone   ?? "UTC";

		// What hour is it for this user right now?
		const userHour = Number(
			new Date().toLocaleString("en-US", { hour: "2-digit", hour12: false, timeZone: tz }),
		);

		if (userHour !== hour) return false;            // not their hour
		if (lastFlushAt && isSameDayInTz(lastFlushAt, new Date(), tz)) return false;  // already sent today
		return true;
	},
	renderItem:   async (opts) => ({ /* ... */ }),
	renderDigest: async ({ items, ctx, userId }) => ({ /* ... */ }),
},
```

Per-user timezone + hour, configurable from your settings UI, fully
honored. The framework persists `lastFlushAt` per `(notification,
digestKey)` so you don't have to track it yourself.

### Flush frequencies vs delivery time

| Pulse interval (`digestSchedule`) | What it controls |
|---|---|
| Short (5–15 min) | How often the framework checks each user's `flushWhen`. The user can have minute-level precision on their delivery time. |
| Medium (1 hour) | Cheaper. Users get hourly precision. Fine for daily digests. |
| Long (1 day) | One flush attempt per day per user. Use only when delivery time is fixed for everyone. |

For a true "fixed time, same for everyone" digest, omit `flushWhen`
and set `digestSchedule` directly to that cron (`0 8 * * *`). The
pulse and the flush coincide.

## Per-user preferences override the mode

A user might prefer instant email even though the notification's
default is digest. Preferences can override the mode per channel:

```ts
serve({
	notify: {
		// ... adapters
		preferences: async (userId, ctx, notificationName) => {
			const row = ctx.db.prepare(
				"SELECT * FROM user_prefs WHERE userId = ? AND notification = ?",
			).get(userId, notificationName);
			return {
				push:  row?.push  ?? { enabled: true, mode: "instant" },
				email: row?.email ?? { enabled: true, mode: "digest" },
				inApp: row?.inApp ?? { enabled: true, mode: "instant" },
			};
		},
	},
});
```

The preference shape per channel:

```ts
type ChannelPreference = {
	enabled: boolean;
	mode?:   "instant" | "deferred" | "digest";   // override the notification's default
	delay?:  number;                              // override for deferred mode
};
```

`enabled: false` skips the channel entirely. `mode: "digest"` flips
an instant channel into digest mode using the channel's
`renderDigest` (which must therefore be defined). Missing `mode`
keeps the notification's declared default.

## Channels keys match adapter names

`channels` keys match adapter names configured in `serve({ notify })`.
Each render function (or `renderItem` / `renderDigest`) receives the
same `opts` other actions get (`opts.input`, `opts.ctx`) and returns
the payload the adapter expects for that channel.

## Methods on the typed reference

| Method | What it does |
|---|---|
| `notification.send(input, opts?)` | Dispatch via configured channels. Returns `{ <channel>: jobId }` |
| `notification.preview(input)` | Run every channel's render function without sending; returns `{ <channel>: payload }` |
| `notification.run(opts)` | Direct call — useful for testing render functions |
| `notification.now(input)` | Same as `send` (alias for symmetry with `createJob`) |
| `notification.at(date, input)` | Schedule for a specific time |
| `notification.in(ms, input)` | Sugar for `at(new Date(Date.now() + ms), input)` |

```ts
notification.send({ userId: "u-1" });

notification.send({ userId: "u-1" }, { channels: ["email"] });        // restrict
notification.send({ userId: "u-1" }, { channels: ["email", "push"] });

notification.at(new Date("2026-12-25T09:00Z"), { userId: "u-1" });

notification.preview({ userId: "u-1" });
// → { email: { to, subject, ... }, push: { title, body, ... }, inApp: { kind, body } }
```

## Channel adapters

Configure adapters once on `serve()`:

```ts
import { serve } from "@vyn/server";
import { postmarkAdapter } from "@vyn/notify-postmark";
import { webPushAdapter }  from "@vyn/notify-web-push";
import { onNotification }  from "./features/inbox/inbox.actions.ts";

serve({
	port: env.PORT,
	jobs: { /* ... */ },     // notifications require a job store
	notify: {
		email: postmarkAdapter({ token: env.POSTMARK_TOKEN, from: env.EMAIL_FROM }),
		push:  webPushAdapter({ publicKey: env.VAPID_PUBLIC, privateKey: env.VAPID_PRIVATE, contact: env.VAPID_CONTACT }),
		inApp: { subscription: onNotification },
	},
});
```

### Adapter interface

```ts
export interface NotificationAdapter<TPayload> {
	send(payload: TPayload, ctx: BaseCtx & Record<string, unknown>): Promise<void>;
	name?: string;
}
```

The framework ships adapters as separate packages so you only pay for
what you use:

| Package | Channel |
|---|---|
| `@vyn/notify-postmark` | Email via Postmark |
| `@vyn/notify-ses`      | Email via Amazon SES |
| `@vyn/notify-sendgrid` | Email via SendGrid |
| `@vyn/notify-smtp`     | Email via any SMTP host |
| `@vyn/notify-web-push` | Web Push (browser notifications) |
| `@vyn/notify-fcm`      | Firebase Cloud Messaging |
| `@vyn/notify-apns`     | Apple Push Notification service |

In-app uses an existing subscription as the channel — no separate
package. Mutations call `notification.send(...)`; the framework
emits to the subscription, which connected clients listen to.

Custom channels (SMS, Slack, internal hooks) are one function:

```ts
export const slackAdapter = (opts) => ({
	send: async (payload, ctx) => {
		await fetch(`https://hooks.slack.com/services/${opts.webhook}`, {
			method: "POST",
			body:   JSON.stringify(payload),
		});
	},
});

serve({
	notify: { slack: slackAdapter({ webhook: env.SLACK_HOOK }) },
});
```

## Per-user preferences

The framework looks up user preferences before fanning out to
channels. A preference object is `{ <channel>: boolean }`; missing
entries default to `true`.

Provide a preference reader at config time:

```ts
serve({
	notify: {
		email: postmarkAdapter({ ... }),
		push:  webPushAdapter({ ... }),
		inApp: { subscription: onNotification },
		preferences: async (userId, ctx) => {
			const row = ctx.db.prepare("SELECT * FROM user_prefs WHERE userId = ?").get(userId);
			return { email: row?.email ?? true, push: row?.push ?? true, inApp: true };
		},
	},
});
```

The notification's render functions still run for every channel
(useful for `preview()`), but only the channels the user opted into
actually send.

To find the user, the framework looks up `opts.input.userId` by
convention. Override per-notification:

```ts
createNotification({
	channels: { ... },
	getUserId: (input) => input.recipient._id,    // custom resolver
});
```

For notifications that don't target a specific user (a server-wide
alert), set `getUserId: null` and the preference check is skipped.

## Templates with shared rendering

For notifications that share copy across channels, render once and
re-use:

```ts
function digestBody(items: Array<{ title: string; url: string }>) {
	return items.map((i) => `${i.title} — ${i.url}`).join("\n");
}

export const dailyDigest = createNotification({
	input: v.object({ userId: v.string(), items: v.array(/* ... */) }),
	channels: {
		email: async (opts) => ({
			subject: `Your daily digest`,
			text:    digestBody(opts.input.items),
			html:    digestBody(opts.input.items).replace(/\n/g, "<br>"),
		}),
		inApp: async (opts) => ({ kind: "digest", body: digestBody(opts.input.items) }),
	},
	schedule: { cron: "0 9 * * *" },   // every morning
});
```

For richer templating (MJML for email, JSX-like trees), import a
library inside the render function. Vyn doesn't bundle a templating
engine — that's app-specific.

## Synergy with `createJob`

A notification is structurally a job that fans out to channels. The
two primitives share:

- `input` validation
- `retries`, `backoff`, `timeout`
- `schedule` for recurring delivery
- Worker execution model (jobs and notifications run on the same workers)
- `.now()` / `.at()` / `.in()` scheduling methods
- `tool` exposure for LLM surfaces
- Direct `.run(opts)` for tests

What `createNotification` adds:

- Multi-channel fan-out
- Per-user preference lookup
- Per-channel adapter routing
- `.send()` semantics with channel filtering
- `.preview()` for inspecting rendered output

Use `createNotification` when delivery has multiple channels or
needs per-user preferences. Use `createJob` for everything else
deferred or scheduled (cleanup, indexing, report generation, batch
work).

## CLI

```sh
vyn notify list                    # show pending + recent
vyn notify send <name> [--input='{...}'] [--channels=email,push]
vyn notify preview <name> --input='{...}'    # render without sending
vyn notify retry <jobId>
```

## Observability

The framework emits events through `ctx.bus` for every notification
lifecycle step:

- `notify.sent` `{ name, channel, userId, jobId }`
- `notify.delivered` `{ name, channel, userId, jobId, providerId? }`
- `notify.failed` `{ name, channel, userId, jobId, error }`
- `notify.skipped` `{ name, channel, userId, reason: "preference" }`

Pipe through your transport / logger / analytics like any other
bus event.

## See also

- [Jobs](/guide/jobs/) — the foundation; notifications are job-backed
- [Actions](/guide/actions/) — the registry that holds notifications alongside jobs and other primitives
- [Realtime](/guide/realtime/) — in-app notifications usually pair with a subscription
- [Configuration](/guide/configuration/) — `serve({ notify })` shape

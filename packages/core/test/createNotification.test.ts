import { describe, expect, it } from "vitest";

// Contracts from /guide/notifications/
describe.todo("createNotification — returns an action record with kind 'notification'");
describe.todo("createNotification — registers in the global registry");

describe.todo("notification.send(input) — fans out to every configured channel");
describe.todo("notification.send(input, { channels }) — restricts to listed channels");
describe.todo("notification.preview(input) — returns rendered payloads without sending");
describe.todo("notification.run(opts) — direct call (testing renders)");
describe.todo("notification.now(input) — alias for send");
describe.todo("notification.at(date, input) — schedules send for specific time");
describe.todo("notification.in(ms, input) — sugar for at(now + ms)");

describe.todo("channels — short form (function) defaults to instant mode");
describe.todo("channels — long form (object) supports mode field");

describe.todo("mode=instant — renders + dispatches immediately via adapter");
describe.todo("mode=deferred — enqueues a job with delay ms");
describe.todo("mode=digest — accumulates per digestKey; flush job runs renderDigest");

describe.todo("digest — digestKey(input) groups accumulating events");
describe.todo("digest — digestSchedule cron/interval flushes the queue");
describe.todo("digest — digestMaxAge drops items older than threshold");
describe.todo("digest — renderItem produces minimal per-event records");
describe.todo("digest — renderDigest receives { items, ctx, userId } and produces final payload");

describe.todo("preferences — preferences resolver called per (userId, notificationName)");
describe.todo("preferences.enabled=false — skips that channel");
describe.todo("preferences.mode override — flips notification's default mode for the user");
describe.todo("preferences.delay override — adjusts deferred delay per user");

describe.todo("getUserId — defaults to input.userId; configurable per-notification");
describe.todo("getUserId=null — skips preference check (system-wide notifications)");

describe.todo("Channel adapters — interface { send(payload, ctx): Promise<void> }");
describe.todo("Adapters share the job store with createJob — same retry semantics");

describe.todo("Bus events — notify.sent, notify.delivered, notify.failed, notify.skipped");

describe.todo("retries + backoff inherited from createJob semantics");
describe.todo("schedule on the notification itself — for recurring digest-like notifications");

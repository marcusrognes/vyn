---
title: live
description: A small helper that announces a string to screen readers via an off-screen aria-live region. The bus toasts, status messages, and validation errors use.
sidebar:
  order: 12
---

`@vyn/ui/live` exposes a single function: `liveRegion(message, level?)`.
It announces `message` to screen readers via a shared off-screen
region with the right `aria-live` politeness. Use it for status
updates that don't have a visible UI element — saved confirmations,
soft errors, "5 new notes," anything you want spoken aloud.

```ts
import { liveRegion } from "@vyn/ui/live";

await rpc.notes.save.mutate({ ... });
liveRegion("Note saved");

await rpc.notes.delete.mutate({ ... });
liveRegion("Could not delete: not your note", "assertive");
```

The behavior creates two singleton regions on first import (one
polite, one assertive) and rotates messages through them. You don't
manage their lifecycle.

## API

```ts
function liveRegion(
	message: string,
	level?: "polite" | "assertive",   // default "polite"
): void;
```

- `"polite"` (default) — waits for a pause in screen-reader output;
  use for non-urgent status.
- `"assertive"` — interrupts the current output; use for errors and
  warnings only. Don't reach for this casually; it's harsh.

## What it does

- Creates two `<div>` elements at document body, both visually
  hidden (CSS off-screen) but accessible: one with
  `aria-live="polite"`, one with `aria-live="assertive"`.
- Each call clears the relevant region, then writes the message
  (the clear-then-write is what triggers re-announcement when the
  same message fires twice).
- Throttles to one announcement per 100ms per region to prevent
  message stacking.

## When to use this vs other patterns

- For toasts with visible UI, use the [`<v-toaster>`](/ui/toast/)
  widget — it composes `liveRegion` internally with a visual stack.
- For per-field form errors, use
  [`aria-describedby`](/ui/aria-describedby/) — the error is
  announced when the field receives focus.
- For loading states, use `aria-busy` on the affected element.
  `liveRegion` is overkill for "loading…" indicators.

## See also

- [`<v-toaster>`](/ui/toast/) — visual toasts that compose this
- [`@vyn/ui/aria-describedby`](/ui/aria-describedby/) — for per-element descriptions

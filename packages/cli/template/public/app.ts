// Shared app singletons — RPC client + cache. Importing these from
// `./app.ts` instead of calling `createApp()` per file keeps every
// view talking to the same connection and cache.

import { createApp } from "@vynjs/client";
import type { AppRouter } from "../_vyn.gen.ts";

export const { rpc, cache } = createApp<AppRouter>();

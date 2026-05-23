import { createApp, $ } from "@vynjs/client";
import type { AppRouter } from "../_vyn.gen.ts";

const { rpc } = createApp<AppRouter>();
const greeting = await rpc.hello.greet.query({ name: "you" });
$("#greeting").textContent = greeting;

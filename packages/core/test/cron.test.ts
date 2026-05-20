import { describe, expect, it } from "vitest";
import { parseCron, previousTick, nextTick } from "../src/cron.ts";

describe("parseCron", () => {
	it("parses '0 8 * * *'", () => {
		const c = parseCron("0 8 * * *");
		expect(c.minute).toEqual([0]);
		expect(c.hour).toEqual([8]);
		expect(c.dom.length).toBe(31);
		expect(c.month.length).toBe(12);
		expect(c.dow.length).toBe(7);
	});

	it("parses '*/15 * * * *' (every 15 minutes)", () => {
		const c = parseCron("*/15 * * * *");
		expect(c.minute).toEqual([0, 15, 30, 45]);
	});

	it("parses '0 9 * * 1' (Mondays at 09:00)", () => {
		const c = parseCron("0 9 * * 1");
		expect(c.dow).toEqual([1]);
	});

	it("parses '0 8 * * 1-5' (weekdays at 08:00)", () => {
		const c = parseCron("0 8 * * 1-5");
		expect(c.dow).toEqual([1, 2, 3, 4, 5]);
	});

	it("parses '0 9,17 * * *' (twice daily)", () => {
		const c = parseCron("0 9,17 * * *");
		expect(c.hour).toEqual([9, 17]);
	});

	it("rejects invalid expressions", () => {
		expect(() => parseCron("not cron")).toThrow();
		expect(() => parseCron("0 25 * * *")).toThrow();      // hour out of range
		expect(() => parseCron("0 8 * * *  extra")).toThrow();
	});
});

describe("previousTick / nextTick", () => {
	it("daily 08:00 UTC: returns this morning if we're past it, yesterday morning otherwise", () => {
		const cron = parseCron("0 8 * * *");
		const noon = new Date("2026-05-20T12:00:00Z");
		const prev = previousTick(cron, noon, "UTC");
		expect(prev!.toISOString()).toBe("2026-05-20T08:00:00.000Z");

		const next = nextTick(cron, noon, "UTC");
		expect(next!.toISOString()).toBe("2026-05-21T08:00:00.000Z");
	});

	it("weekly Monday 09:00 UTC: returns the most recent Monday at 09:00", () => {
		const cron = parseCron("0 9 * * 1");
		// 2026-05-20 is a Wednesday; previous Monday is 2026-05-18.
		const wed = new Date("2026-05-20T15:00:00Z");
		const prev = previousTick(cron, wed, "UTC");
		expect(prev!.toISOString()).toBe("2026-05-18T09:00:00.000Z");
	});

	it("honors timezone — '0 9 * * *' fires at 09:00 LOCAL not 09:00 UTC", () => {
		const cron = parseCron("0 9 * * *");
		// 09:00 in Europe/Oslo on 2026-05-20 is 07:00 UTC (CEST = UTC+2)
		const t = new Date("2026-05-20T10:00:00Z");
		const prev = previousTick(cron, t, "Europe/Oslo");
		expect(prev!.toISOString()).toBe("2026-05-20T07:00:00.000Z");
	});

	it("returns undefined when no firing exists within the window", () => {
		const cron = parseCron("0 9 31 2 *");   // never (Feb 31)
		const t = new Date("2026-05-20T10:00:00Z");
		expect(previousTick(cron, t, "UTC", 30 * 24 * 60 * 60_000)).toBeUndefined();
	});
});

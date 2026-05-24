// Minimal cron parser + next-tick / previous-tick computation.
// Supports the standard 5 fields: minute hour day-of-month month day-of-week.
// Each field is "*", a comma-separated list of integers or ranges (a-b),
// or "*/n" stepping.
//
// Timezone-aware: pass an IANA timezone string to evaluate the expression
// in that user's local time. We use Intl.DateTimeFormat to read the local
// wall clock; works in every modern runtime.

export type CronExpression = {
	minute: Field;
	hour: Field;
	dom: Field; // day-of-month
	month: Field;
	dow: Field; // day-of-week (0=Sun)
};

type Field = number[]; // sorted unique list of permitted values, or "*" → all

const MIN_RANGE = [0, 59];
const HOUR_RANGE = [0, 23];
const DOM_RANGE = [1, 31];
const MONTH_RANGE = [1, 12];
const DOW_RANGE = [0, 6];

const STAR_MIN = range(0, 59);
const STAR_HOUR = range(0, 23);
const STAR_DOM = range(1, 31);
const STAR_MONTH = range(1, 12);
const STAR_DOW = range(0, 6);

export function parseCron(expr: string): CronExpression {
	const parts = expr.trim().split(/\s+/);
	if (parts.length !== 5) {
		throw new Error(`invalid cron: ${expr} (expected 5 fields)`);
	}
	return {
		minute: parseField(parts[0], MIN_RANGE),
		hour: parseField(parts[1], HOUR_RANGE),
		dom: parseField(parts[2], DOM_RANGE),
		month: parseField(parts[3], MONTH_RANGE),
		dow: parseField(parts[4], DOW_RANGE),
	};
}

function parseField(raw: string, [lo, hi]: number[]): Field {
	const star = lo === 0 ? STAR_MIN : lo === 1 ? STAR_DOM : range(lo, hi);
	if (raw === "*") return raw === "*" ? range(lo, hi) : star;
	const out = new Set<number>();
	for (const part of raw.split(",")) {
		// Step: a/b, a-b/c, */c
		const step = part.match(/^(.+?)\/(\d+)$/);
		if (step) {
			const base = step[1] === "*" ? `${lo}-${hi}` : step[1];
			const stride = Number(step[2]);
			for (const v of parseField(base, [lo, hi])) {
				if (((v - lo) % stride) === 0) out.add(v);
			}
			continue;
		}
		// Range: a-b
		const r = part.match(/^(\d+)-(\d+)$/);
		if (r) {
			for (let i = Number(r[1]); i <= Number(r[2]); i++) out.add(i);
			continue;
		}
		// Single number
		if (/^\d+$/.test(part)) {
			const n = Number(part);
			if (n < lo || n > hi) throw new Error(`cron value out of range: ${part}`);
			out.add(n);
			continue;
		}
		throw new Error(`cron token unrecognized: ${part}`);
	}
	return [...out].sort((a, b) => a - b);
}

function range(lo: number, hi: number): number[] {
	const out: number[] = [];
	for (let i = lo; i <= hi; i++) out.push(i);
	return out;
}

// In timezone tz, what is the local Date components for the given UTC instant?
function localParts(
	instant: Date,
	tz: string,
): { y: number; mo: number; d: number; h: number; mi: number; dow: number } {
	// Intl.DateTimeFormat returns the wall-clock components in the named TZ.
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		weekday: "short",
	});
	const parts = Object.fromEntries(
		fmt.formatToParts(instant).map((p) => [p.type, p.value]),
	);
	const dowMap: Record<string, number> = {
		Sun: 0,
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6,
	};
	return {
		y: Number(parts.year),
		mo: Number(parts.month),
		d: Number(parts.day),
		h: Number(parts.hour) % 24, // Intl can return "24" at midnight on some locales
		mi: Number(parts.minute),
		dow: dowMap[parts.weekday!] ?? 0,
	};
}

function matches(
	cron: CronExpression,
	lp: ReturnType<typeof localParts>,
): boolean {
	if (!cron.minute.includes(lp.mi)) return false;
	if (!cron.hour.includes(lp.h)) return false;
	if (!cron.month.includes(lp.mo)) return false;

	// POSIX cron quirk: if both day-of-month and day-of-week are restricted
	// (not full ranges), OR them. If only one is restricted, AND.
	const domFull = cron.dom.length === 31;
	const dowFull = cron.dow.length === 7;
	const domOk = cron.dom.includes(lp.d);
	const dowOk = cron.dow.includes(lp.dow);

	if (domFull && dowFull) return true;
	if (domFull) return dowOk;
	if (dowFull) return domOk;
	return domOk || dowOk;
}

// Walks one minute at a time backward from `from`, in tz-local wall clock,
// to find the most recent firing instant of `cron`. Returns undefined if
// no firing found within `windowMs` (default 366 days).
export function previousTick(
	cron: CronExpression,
	from: Date,
	tz: string,
	windowMs = 366 * 24 * 60 * 60_000,
): Date | undefined {
	const start = from.getTime();
	const limit = start - windowMs;
	// Start at the start of the current minute.
	let t = Math.floor(start / 60_000) * 60_000;
	while (t >= limit) {
		const d = new Date(t);
		const lp = localParts(d, tz);
		if (matches(cron, lp)) return d;
		t -= 60_000;
	}
	return undefined;
}

// Forward search. Useful for "when's the next firing after now?"
export function nextTick(
	cron: CronExpression,
	from: Date,
	tz: string,
	windowMs = 366 * 24 * 60 * 60_000,
): Date | undefined {
	const start = from.getTime();
	const limit = start + windowMs;
	let t = Math.ceil(start / 60_000) * 60_000;
	while (t <= limit) {
		const d = new Date(t);
		const lp = localParts(d, tz);
		if (matches(cron, lp)) return d;
		t += 60_000;
	}
	return undefined;
}

// live() — programmatic announcements via singleton aria-live regions.
// Two regions: polite + assertive. Throttled so back-to-back calls
// don't fight.

const REGION_ID = "vyn-live-region";

let politeQueue: string[] = [];
let assertiveQueue: string[] = [];
let politeTimer: ReturnType<typeof setTimeout> | null = null;

function ensureRegion(): { polite: HTMLElement; assertive: HTMLElement } {
	let polite    = document.getElementById(REGION_ID + "-polite");
	let assertive = document.getElementById(REGION_ID + "-assertive");
	if (!polite) {
		polite = document.createElement("div");
		polite.id            = REGION_ID + "-polite";
		polite.setAttribute("aria-live", "polite");
		polite.setAttribute("aria-atomic", "true");
		polite.style.cssText = "position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden";
		document.body.appendChild(polite);
	}
	if (!assertive) {
		assertive = document.createElement("div");
		assertive.id            = REGION_ID + "-assertive";
		assertive.setAttribute("aria-live", "assertive");
		assertive.setAttribute("aria-atomic", "true");
		assertive.style.cssText = "position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden";
		document.body.appendChild(assertive);
	}
	return { polite, assertive };
}

export function live(message: string, opts: { assertive?: boolean } = {}): void {
	const { polite, assertive } = ensureRegion();
	if (opts.assertive) {
		assertiveQueue.push(message);
		assertive.textContent = assertiveQueue.shift()!;
		return;
	}
	politeQueue.push(message);
	if (!politeTimer) {
		politeTimer = setTimeout(() => {
			polite.textContent = politeQueue.shift() ?? "";
			politeTimer = null;
			if (politeQueue.length) live(politeQueue.shift()!);
		}, 150);
	}
}

// Expose globally for app code that prefers a global.
if (typeof window !== "undefined") (window as any).vynLive = live;

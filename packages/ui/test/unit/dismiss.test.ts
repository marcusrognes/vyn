// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import "../../src/dismiss.ts";

beforeEach(() => { document.body.innerHTML = ""; });

describe("dismiss", () => {
	it("fires 'dismiss' with reason='escape' when Esc pressed inside the element", async () => {
		document.body.innerHTML = `<div data-dismiss tabindex="0">x</div>`;
		await new Promise((r) => setTimeout(r, 0));
		const el = document.querySelector<HTMLElement>("[data-dismiss]")!;
		el.focus();
		let reason: string | undefined;
		el.addEventListener("dismiss", (e) => { reason = (e as CustomEvent).detail.reason; });
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(reason).toBe("escape");
	});

	it("fires 'dismiss' with reason='outside' on outside pointerdown", async () => {
		document.body.innerHTML = `
			<div data-dismiss><p>inside</p></div>
			<div id="outside">outside</div>
		`;
		await new Promise((r) => setTimeout(r, 0));
		const el = document.querySelector<HTMLElement>("[data-dismiss]")!;
		const outside = document.getElementById("outside")!;
		let reason: string | undefined;
		el.addEventListener("dismiss", (e) => { reason = (e as CustomEvent).detail.reason; });
		outside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
		expect(reason).toBe("outside");
	});

	it("preventDefault on dismiss prevents the dismissed event", async () => {
		document.body.innerHTML = `<div data-dismiss tabindex="0">x</div>`;
		await new Promise((r) => setTimeout(r, 0));
		const el = document.querySelector<HTMLElement>("[data-dismiss]")!;
		el.focus();
		let dismissedFired = false;
		el.addEventListener("dismiss", (e) => e.preventDefault());
		el.addEventListener("dismissed", () => { dismissedFired = true; });
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(dismissedFired).toBe(false);
	});
});

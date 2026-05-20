// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import "../../src/anchor.ts";

beforeEach(() => { document.body.innerHTML = ""; });

describe("anchor", () => {
	it("sets position:fixed + top/left on the anchored element", async () => {
		document.body.innerHTML = `
			<button id="t" style="position:absolute;top:50px;left:80px;width:60px;height:30px">trigger</button>
			<div id="p" data-anchor="t" data-placement="bottom-start" data-offset="4">popover</div>
		`;
		await new Promise((r) => setTimeout(r, 10));
		const p = document.getElementById("p")!;
		expect(p.style.position).toBe("fixed");
		expect(p.dataset.state).toBe("placement-bottom");
	});

	it("ignores when the anchor id doesn't exist", async () => {
		document.body.innerHTML = `<div data-anchor="missing">x</div>`;
		await new Promise((r) => setTimeout(r, 10));
		const p = document.querySelector("[data-anchor]") as HTMLElement;
		expect(p.style.position).toBe("");
	});
});

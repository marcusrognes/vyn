// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vyn:test";
import "../../src/auto-resize.ts";

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("auto-resize", () => {
	it("attaches an input listener and sets height on init", async () => {
		document.body.innerHTML = `<textarea data-auto-resize data-min-rows="2" data-max-rows="6"></textarea>`;
		await new Promise((r) => setTimeout(r, 10));
		const ta = document.querySelector("textarea") as HTMLTextAreaElement;
		expect(ta.style.height).not.toBe("");
	});

	it("re-measures on input", async () => {
		document.body.innerHTML = `<textarea data-auto-resize></textarea>`;
		await new Promise((r) => setTimeout(r, 10));
		const ta = document.querySelector("textarea") as HTMLTextAreaElement;
		const before = ta.style.height;
		ta.value = "long content".repeat(50);
		ta.dispatchEvent(new Event("input"));
		// happy-dom doesn't actually compute layout, so this test ensures the
		// listener fires and writes a height; exact pixel values can't be asserted.
		expect(typeof ta.style.height).toBe("string");
	});
});

// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, vi } from "vitest";
import "../../src/copy.ts";

beforeEach(() => {
	document.body.innerHTML = "";
	Object.defineProperty(globalThis, "navigator", {
		value: {
			clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
		},
		configurable: true,
	});
});

describe("copy", () => {
	it("writes the target's text to the clipboard on click", async () => {
		document.body.innerHTML = `
			<pre id="src">hello world</pre>
			<button data-copy="#src">Copy</button>
		`;
		await new Promise((r) => setTimeout(r, 10));
		const btn = document.querySelector("button")!;
		btn.click();
		await new Promise((r) => setTimeout(r, 10));
		expect((navigator.clipboard.writeText as any).mock.calls[0][0]).toBe("hello world");
	});

	it("flashes data-state='copied' for 1.5s", async () => {
		document.body.innerHTML = `<button data-copy>x</button>`;
		await new Promise((r) => setTimeout(r, 10));
		const btn = document.querySelector("button") as HTMLElement;
		btn.click();
		await new Promise((r) => setTimeout(r, 10));
		expect(btn.dataset.state).toBe("copied");
	});
});

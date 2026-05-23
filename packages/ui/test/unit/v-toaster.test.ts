// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vyn:test";
import "../../src/v-toaster.ts";

beforeEach(() => { document.body.innerHTML = ""; });

describe("<v-toaster>", () => {
	it("vynToast appends a toast element", async () => {
		const id = (window as any).vynToast({ body: "hi" });
		expect(typeof id).toBe("number");
		const t = document.querySelector("v-toaster")!;
		expect(t.children.length).toBe(1);
	});

	it("clicking a toast dismisses it", async () => {
		(window as any).vynToast({ body: "removable" });
		const toaster = document.querySelector("v-toaster")!;
		const toast   = toaster.children[0] as HTMLElement;
		toast.click();
		expect(toaster.children.length).toBe(0);
	});

	it("timeout 0 keeps the toast indefinitely", async () => {
		(window as any).vynToast({ body: "sticky", timeout: 0 });
		const toaster = document.querySelector("v-toaster")!;
		await new Promise((r) => setTimeout(r, 100));
		expect(toaster.children.length).toBe(1);
	});
});

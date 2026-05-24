// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vyn:test";
import { toast } from "../../src/v-toaster.ts";

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("<v-toaster>", () => {
	it("toast() appends a toast element", async () => {
		const id = toast({ body: "hi" });
		expect(typeof id).toBe("number");
		const t = document.querySelector("v-toaster")!;
		expect(t.children.length).toBe(1);
	});

	it("clicking a toast dismisses it", async () => {
		toast({ body: "removable" });
		const toaster = document.querySelector("v-toaster")!;
		const el = toaster.children[0] as HTMLElement;
		el.click();
		expect(toaster.children.length).toBe(0);
	});

	it("timeout 0 keeps the toast indefinitely", async () => {
		toast({ body: "sticky", timeout: 0 });
		const toaster = document.querySelector("v-toaster")!;
		await new Promise((r) => setTimeout(r, 100));
		expect(toaster.children.length).toBe(1);
	});
});

// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import "../../src/edit.ts";

beforeEach(() => { document.body.innerHTML = ""; });

describe("edit", () => {
	it("dblclick swaps text for an input", async () => {
		document.body.innerHTML = `<td data-edit>Hello</td>`;
		await new Promise((r) => setTimeout(r, 10));
		const cell = document.querySelector<HTMLElement>("[data-edit]")!;
		cell.dispatchEvent(new MouseEvent("dblclick"));
		expect(cell.querySelector("input")).not.toBeNull();
	});

	it("Enter commits and fires 'change' with new value", async () => {
		document.body.innerHTML = `<td data-edit tabindex="0">old</td>`;
		await new Promise((r) => setTimeout(r, 10));
		const cell = document.querySelector<HTMLElement>("[data-edit]")!;
		let received: { value: string; previous: string } | undefined;
		cell.addEventListener("change", (e) => { received = (e as CustomEvent).detail; });
		cell.dispatchEvent(new MouseEvent("dblclick"));
		const input = cell.querySelector("input") as HTMLInputElement;
		input.value = "new";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(received).toEqual({ value: "new", previous: "old" });
		expect(cell.textContent).toBe("new");
	});

	it("Esc cancels and restores the original text", async () => {
		document.body.innerHTML = `<td data-edit tabindex="0">old</td>`;
		await new Promise((r) => setTimeout(r, 10));
		const cell = document.querySelector<HTMLElement>("[data-edit]")!;
		cell.dispatchEvent(new MouseEvent("dblclick"));
		const input = cell.querySelector("input") as HTMLInputElement;
		input.value = "abandoned";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(cell.textContent).toBe("old");
	});
});

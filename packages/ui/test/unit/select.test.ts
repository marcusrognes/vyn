// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vyn:test";
import "../../src/select.ts";

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("select", () => {
	it("single mode: clicking an item sets data-value and aria-selected", async () => {
		document.body.innerHTML = `
			<ul data-select>
				<li data-value="a">A</li>
				<li data-value="b">B</li>
			</ul>
		`;
		await new Promise((r) => setTimeout(r, 0));
		const ul = document.querySelector<HTMLElement>("[data-select]")!;
		const items = ul.querySelectorAll<HTMLElement>("[data-value]");
		items[1].click();
		expect(ul.dataset.value).toBe("b");
		expect(items[0].getAttribute("aria-selected")).toBe("false");
		expect(items[1].getAttribute("aria-selected")).toBe("true");
	});

	it("multi mode: clicking toggles membership", async () => {
		document.body.innerHTML = `
			<ul data-select="multiple">
				<li data-value="a">A</li>
				<li data-value="b">B</li>
				<li data-value="c">C</li>
			</ul>
		`;
		await new Promise((r) => setTimeout(r, 0));
		const ul = document.querySelector<HTMLElement>("[data-select]")!;
		const items = ul.querySelectorAll<HTMLElement>("[data-value]");
		items[0].click();
		items[2].click();
		expect(ul.dataset.value).toBe("a,c");
		items[0].click();
		expect(ul.dataset.value).toBe("c");
	});

	it("fires 'change' with the new value", async () => {
		document.body.innerHTML = `
			<ul data-select>
				<li data-value="x">X</li>
			</ul>
		`;
		await new Promise((r) => setTimeout(r, 0));
		const ul = document.querySelector<HTMLElement>("[data-select]")!;
		let received: unknown;
		ul.addEventListener("change", (e) => {
			received = (e as CustomEvent).detail.value;
		});
		ul.querySelector<HTMLElement>("[data-value]")!.click();
		expect(received).toBe("x");
	});
});

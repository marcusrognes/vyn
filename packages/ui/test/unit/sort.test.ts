// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vyn:test";
import "../../src/sort.ts";

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("sort", () => {
	it("clicking a header cycles asc → desc → unsorted", async () => {
		document.body.innerHTML = `
			<thead data-sort>
				<tr>
					<th data-sort-key="name">Name</th>
					<th data-sort-key="date">Date</th>
				</tr>
			</thead>
		`;
		await new Promise((r) => setTimeout(r, 0));
		const head = document.querySelector<HTMLElement>("[data-sort]")!;
		const th = head.querySelector<HTMLElement>('[data-sort-key="name"]')!;
		const events: unknown[] = [];
		head.addEventListener(
			"sort",
			(e) => events.push((e as CustomEvent).detail),
		);

		th.click();
		expect(th.getAttribute("aria-sort")).toBe("ascending");
		th.click();
		expect(th.getAttribute("aria-sort")).toBe("descending");
		th.click();
		expect(th.getAttribute("aria-sort")).toBe("none");
		expect(events.length).toBe(3);
	});

	it("non-multi mode clears other keys when a new one is sorted", async () => {
		document.body.innerHTML = `
			<thead data-sort>
				<tr>
					<th data-sort-key="a">A</th>
					<th data-sort-key="b">B</th>
				</tr>
			</thead>
		`;
		await new Promise((r) => setTimeout(r, 0));
		const a = document.querySelector<HTMLElement>('[data-sort-key="a"]')!;
		const b = document.querySelector<HTMLElement>('[data-sort-key="b"]')!;
		a.click();
		b.click();
		expect(a.getAttribute("aria-sort")).toBe("none");
		expect(b.getAttribute("aria-sort")).toBe("ascending");
	});

	it("multi mode allows multiple active keys", async () => {
		document.body.innerHTML = `
			<thead data-sort data-sort-multi="true">
				<tr><th data-sort-key="a">A</th><th data-sort-key="b">B</th></tr>
			</thead>
		`;
		await new Promise((r) => setTimeout(r, 0));
		const a = document.querySelector<HTMLElement>('[data-sort-key="a"]')!;
		const b = document.querySelector<HTMLElement>('[data-sort-key="b"]')!;
		a.click();
		b.click();
		expect(a.getAttribute("aria-sort")).toBe("ascending");
		expect(b.getAttribute("aria-sort")).toBe("ascending");
	});
});

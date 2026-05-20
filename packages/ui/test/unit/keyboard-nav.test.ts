// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import "../../src/keyboard-nav.ts";

function setup(html: string): HTMLElement {
	document.body.innerHTML = html;
	// MutationObserver fires async — give it a microtask.
	return document.querySelector<HTMLElement>("[data-keyboard-nav]")!;
}

function key(target: HTMLElement, k: string) {
	target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
}

describe("keyboard-nav", () => {
	beforeEach(() => { document.body.innerHTML = ""; });

	it("sets initial roving tabindex", async () => {
		const container = setup(`
			<ul data-keyboard-nav>
				<li>A</li><li>B</li><li>C</li>
			</ul>
		`);
		await new Promise((r) => setTimeout(r, 0));
		const items = container.querySelectorAll("li");
		expect(items[0].getAttribute("tabindex")).toBe("0");
		expect(items[1].getAttribute("tabindex")).toBe("-1");
		expect(items[2].getAttribute("tabindex")).toBe("-1");
	});

	it("ArrowDown moves focus to next item", async () => {
		const container = setup(`
			<ul data-keyboard-nav>
				<li>A</li><li>B</li><li>C</li>
			</ul>
		`);
		await new Promise((r) => setTimeout(r, 0));
		const items = container.querySelectorAll<HTMLElement>("li");
		items[0].focus();
		key(container, "ArrowDown");
		expect(items[1].getAttribute("tabindex")).toBe("0");
		expect(items[0].getAttribute("tabindex")).toBe("-1");
	});

	it("ArrowUp wraps from first to last", async () => {
		const container = setup(`
			<ul data-keyboard-nav>
				<li>A</li><li>B</li><li>C</li>
			</ul>
		`);
		await new Promise((r) => setTimeout(r, 0));
		const items = container.querySelectorAll<HTMLElement>("li");
		items[0].focus();
		key(container, "ArrowUp");
		expect(items[2].getAttribute("tabindex")).toBe("0");
	});

	it("Home jumps to first; End jumps to last", async () => {
		const container = setup(`
			<ul data-keyboard-nav>
				<li>A</li><li>B</li><li>C</li>
			</ul>
		`);
		await new Promise((r) => setTimeout(r, 0));
		const items = container.querySelectorAll<HTMLElement>("li");
		items[0].focus();
		key(container, "End");
		expect(items[2].getAttribute("tabindex")).toBe("0");
		key(container, "Home");
		expect(items[0].getAttribute("tabindex")).toBe("0");
	});

	it("Enter fires an 'activate' event with the focused item", async () => {
		const container = setup(`
			<ul data-keyboard-nav>
				<li>A</li><li>B</li>
			</ul>
		`);
		await new Promise((r) => setTimeout(r, 0));
		const items = container.querySelectorAll<HTMLElement>("li");
		items[0].focus();
		let activated: HTMLElement | null = null;
		container.addEventListener("activate", (e) => { activated = (e as CustomEvent).detail.item; });
		key(container, "Enter");
		expect(activated).toBe(items[0]);
	});
});

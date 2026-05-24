// File-defined custom elements.
//
//   // todo-row.component.ts
//   import { component, html, render } from "@vynjs/client";
//
//   type Props = { id: string; title: string; done: boolean };
//
//   export default component<Props>((el) => {
//     el.render = () => render(el, html`
//       <input type="checkbox" ${el.props.done ? "checked" : ""}>
//       <span>${el.props.title}</span>
//     `);
//     el.addEventListener("change", () => el.dispatchEvent(new CustomEvent("toggle")));
//     el.render();
//   });
//
// `vyn gen` walks `public/**/*.component.ts`, derives the tag name
// from the basename (must contain a hyphen), and emits a registration
// barrel. Files are organized any way you like — `components/`,
// `atoms/molecules/organisms/`, or sprinkled next to features.
//
// The setup receives `el`, a HostElement<Props> with two extras:
//   - `el.props`: typed proxy over `data-*` attributes
//   - `el.render`: a method *you* assign and call. Re-render = call
//                  el.render() again. No vDOM, no fine-grained
//                  reactivity. Imperative DOM when it matters.
//
// The setup can return a cleanup function — runs on
// disconnectedCallback (route change, manual remove).

import type { Html } from "./html.ts";
import { render as renderHtml } from "./html.ts";

export type HostElement<P> = HTMLElement & {
	props: P;
	render: () => void;
};

export type ComponentSetup<P> = (el: HostElement<P>) => (() => void) | void;

// Typed identity helper. Lets authors write `export default component<Props>(setup)`
// for prop inference without coupling to the registration step.
export function component<P extends object = Record<string, unknown>>(
	setup: ComponentSetup<P>,
): ComponentSetup<P> {
	return setup;
}

// Imperative registration. Called by `_vyn.client.gen.ts` (or manually
// from anywhere a component needs to live under a chosen tag).
export function defineComponent<P extends object = Record<string, unknown>>(
	name: string,
	setup: ComponentSetup<P>,
): void {
	if (!name.includes("-")) {
		throw new Error(
			`defineComponent: tag name "${name}" must contain a hyphen (HTML spec)`,
		);
	}
	if (customElements.get(name)) return;

	class Vc extends HTMLElement {
		props!: P;
		render!: () => void;
		private dispose?: () => void;

		connectedCallback() {
			this.props = new Proxy({} as P, {
				get: (_t, key) => {
					if (typeof key !== "string") return undefined;
					const datasetKey = key as keyof DOMStringMap;
					const v = (this as HTMLElement).dataset[datasetKey];
					if (v !== undefined) return coerce(v);
					return (this as any)[key];
				},
			}) as P;
			// Default render is a no-op until the setup assigns one.
			this.render = () => {};
			const cleanup = setup(this as unknown as HostElement<P>);
			if (typeof cleanup === "function") this.dispose = cleanup;
		}

		disconnectedCallback() {
			this.dispose?.();
		}
	}
	customElements.define(name, Vc);
}

// Re-export so authors can call `render(el, html\`…\`)` inside setup
// without a second import.
export { renderHtml as render };
export type { Html };

// Conservative dataset coercion (same rule used elsewhere): only opt
// in to JSON parsing for unambiguous JSON values. Numeric and other
// strings stay strings, which is what v.string()-typed actions want.
function coerce(v: string): unknown {
	if (v === "true") return true;
	if (v === "false") return false;
	if (v === "null") return null;
	const first = v.charCodeAt(0);
	if (first === 0x7B || first === 0x5B) {
		try {
			return JSON.parse(v);
		} catch { /* fall through */ }
	}
	return v;
}

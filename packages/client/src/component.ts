// Component definition — wraps native custom-element registration so
// apps write a setup function instead of a class. Setup gets the
// element, returns disposal logic. Re-renders happen by calling
// render(el, html`...`) imperatively, same as anywhere else.

import type { Html } from "./html.ts";
import { render } from "./html.ts";

export type ComponentSetup<P> = (opts: {
	el:     HTMLElement;
	props:  P;
	render: (content: Html) => void;
	on:     <K extends keyof HTMLElementEventMap>(type: K, handler: (e: HTMLElementEventMap[K]) => void) => void;
}) => (() => void) | void;

export function component<P extends object = Record<string, unknown>>(name: string, setup: ComponentSetup<P>): void {
	if (customElements.get(name)) return;
	class Vc extends HTMLElement {
		private dispose?: () => void;
		connectedCallback() {
			const props = new Proxy({} as P, {
				get: (_t, key) => {
					if (typeof key !== "string") return undefined;
					const datasetKey = key as keyof DOMStringMap;
					const v = (this as HTMLElement).dataset[datasetKey];
					if (v !== undefined) {
						try { return JSON.parse(v); } catch { return v; }
					}
					return (this as any)[key];
				},
			}) as P;
			const cleanup = setup({
				el: this,
				props,
				render: (content) => render(this, content),
				on: (type, handler) => this.addEventListener(type, handler as any),
			});
			if (typeof cleanup === "function") this.dispose = cleanup;
		}
		disconnectedCallback() {
			this.dispose?.();
		}
	}
	customElements.define(name, Vc);
}

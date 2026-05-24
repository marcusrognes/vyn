// data-sortable on a container — drag children to reorder.
// Pointer-based; keyboard fallback via Space-to-pickup + arrows.
//
// Add `data-sortable-group="<name>"` to multiple containers to let
// items move between them. Each container still fires its own
// `reorder` event with its current order. The destination also
// fires `move` with { id, from, to } when a cross-container move
// commits.

type Drag = {
	node: HTMLElement;
	fromContainer: HTMLElement;
	group?: string;
};

let currentDrag: Drag | null = null;

function init() {
	document.querySelectorAll<HTMLElement>(
		"[data-sortable]:not([data-sortable-wired])",
	).forEach(wire);
}

function wire(container: HTMLElement) {
	container.dataset.sortableWired = "true";
	const group = container.dataset.sortableGroup;
	let pickedKeyboard: HTMLElement | null = null;

	function items(): HTMLElement[] {
		return [...container.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
	}

	function orderOf(c: HTMLElement) {
		return [...c.children]
			.filter((el): el is HTMLElement => el instanceof HTMLElement)
			.map((el, i) => ({ index: i, id: el.dataset.id ?? el.id }));
	}

	function fireReorder(c: HTMLElement) {
		c.dispatchEvent(
			new CustomEvent("reorder", { detail: { order: orderOf(c) } }),
		);
	}

	container.addEventListener("dragstart", (e) => {
		const t = e.target as HTMLElement;
		if (!container.contains(t) || t.parentElement !== container) return;
		currentDrag = { node: t, fromContainer: container, group };
		t.dataset.state = "dragging";
		e.dataTransfer?.setData("text/plain", "");
	});

	container.addEventListener("dragover", (e) => {
		if (!currentDrag) return;

		// Same container? Always accept. Different container? Only if groups match.
		const sameContainer = currentDrag.fromContainer === container ||
			currentDrag.node.parentElement === container;
		const groupsMatch = currentDrag.group !== undefined &&
			currentDrag.group === group;
		if (!sameContainer && !groupsMatch) return;

		e.preventDefault();

		let target = e.target as HTMLElement | null;
		while (target && target.parentElement !== container) {
			target = target.parentElement;
		}

		const peers = items().filter((c) => c !== currentDrag!.node);

		if (!target || target === currentDrag.node) {
			if (peers.length === 0) {
				container.appendChild(currentDrag.node);
				return;
			}
			const firstRect = peers[0].getBoundingClientRect();
			const lastRect = peers[peers.length - 1].getBoundingClientRect();
			if (e.clientY < firstRect.top) {
				container.insertBefore(currentDrag.node, peers[0]);
			} else if (e.clientY > lastRect.bottom) {
				container.appendChild(currentDrag.node);
			}
			return;
		}

		const rect = target.getBoundingClientRect();
		const after = (e.clientY - rect.top) > rect.height / 2;
		container.insertBefore(
			currentDrag.node,
			after ? target.nextSibling : target,
		);
	});

	container.addEventListener("dragend", () => {
		if (!currentDrag) return;
		const { node, fromContainer } = currentDrag;
		delete node.dataset.state;

		const dest = node.parentElement;
		if (dest && dest !== fromContainer) {
			fireReorder(fromContainer);
			fireReorder(dest);
			dest.dispatchEvent(
				new CustomEvent("move", {
					detail: {
						id: node.dataset.id ?? node.id,
						from: fromContainer,
						to: dest,
					},
				}),
			);
		} else if (dest) {
			fireReorder(dest);
		}

		currentDrag = null;
	});

	for (const item of items()) item.setAttribute("draggable", "true");

	// Keyboard pickup.
	container.addEventListener("keydown", (e) => {
		const active = document.activeElement;
		if (
			!(active instanceof HTMLElement) || active.parentElement !== container
		) return;

		if (e.key === " " || e.key === "Enter") {
			e.preventDefault();
			if (pickedKeyboard) {
				delete pickedKeyboard.dataset.state;
				pickedKeyboard = null;
				fireReorder(container);
			} else {
				pickedKeyboard = active;
				active.dataset.state = "picked";
			}
			return;
		}
		if (pickedKeyboard && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
			e.preventDefault();
			const sibling = e.key === "ArrowUp" ? pickedKeyboard.previousElementSibling : pickedKeyboard.nextElementSibling;
			if (sibling) {
				container.insertBefore(
					pickedKeyboard,
					e.key === "ArrowUp" ? sibling : sibling.nextSibling,
				);
				pickedKeyboard.focus();
			}
		}
		if (e.key === "Escape" && pickedKeyboard) {
			delete pickedKeyboard.dataset.state;
			pickedKeyboard = null;
		}
	});

	// Make children focusable.
	for (const item of items()) {
		if (!item.hasAttribute("tabindex")) item.setAttribute("tabindex", "0");
	}
}

if (typeof document !== "undefined") {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else init();
	new MutationObserver(init).observe(
		document.body ?? document.documentElement,
		{ childList: true, subtree: true },
	);
}

export {};

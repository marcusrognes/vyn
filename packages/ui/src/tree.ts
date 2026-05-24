// data-tree — keyboard-navigable nested tree with expand/collapse.
//
// Wire on a <ul> root. Descendant <li> become treeitems; any <li>
// containing a direct child <ul> becomes a folder with `aria-expanded`
// toggling. CSS hides nested groups when collapsed:
//
//   [role="treeitem"][aria-expanded="false"] > [role="group"] { display: none; }
//
// Keyboard:
//   ArrowDown / ArrowUp  — next / prev visible item
//   ArrowRight           — expand folder, or move to first child if open
//   ArrowLeft            — collapse folder, or move to parent
//   Home / End           — first / last visible
//   Enter / Space        — toggle folder, or fire `activate` on a leaf
//
// Events (on the root):
//   `toggle`   { expanded: boolean, item: HTMLElement }
//   `activate` { item: HTMLElement, value: string | undefined }

function init() {
	document.querySelectorAll<HTMLElement>("[data-tree]:not([data-tree-wired])")
		.forEach(wire);
}

function wire(tree: HTMLElement) {
	tree.dataset.treeWired = "true";
	tree.setAttribute("role", "tree");

	for (const li of tree.querySelectorAll<HTMLElement>("li")) {
		li.setAttribute("role", "treeitem");
		if (!li.hasAttribute("tabindex")) li.setAttribute("tabindex", "-1");
		const childUl = li.querySelector<HTMLElement>(":scope > ul");
		if (childUl) {
			childUl.setAttribute("role", "group");
			if (!li.hasAttribute("aria-expanded")) {
				li.setAttribute("aria-expanded", "false");
			}
		}
	}
	const first = tree.querySelector<HTMLElement>("li");
	if (first) first.setAttribute("tabindex", "0");

	tree.addEventListener("keydown", (e) => {
		const active = document.activeElement;
		if (!(active instanceof HTMLElement)) return;
		if (active.getAttribute("role") !== "treeitem" || !tree.contains(active)) {
			return;
		}

		const visible = visibleItems(tree);
		const idx = visible.indexOf(active);
		const expandable = active.hasAttribute("aria-expanded");
		const expanded = active.getAttribute("aria-expanded") === "true";

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				focusItem(tree, visible[idx + 1]);
				break;
			case "ArrowUp":
				e.preventDefault();
				focusItem(tree, visible[idx - 1]);
				break;
			case "ArrowRight":
				e.preventDefault();
				if (expandable && !expanded) toggle(active, true);
				else if (expandable && expanded) {
					const next = visibleItems(tree)[idx + 1];
					if (next && parentTreeItem(next) === active) focusItem(tree, next);
				}
				break;
			case "ArrowLeft":
				e.preventDefault();
				if (expandable && expanded) toggle(active, false);
				else focusItem(tree, parentTreeItem(active));
				break;
			case "Home":
				e.preventDefault();
				focusItem(tree, visible[0]);
				break;
			case "End":
				e.preventDefault();
				focusItem(tree, visible[visible.length - 1]);
				break;
			case "Enter":
			case " ":
				e.preventDefault();
				if (expandable) toggle(active, !expanded);
				else activate(tree, active);
				break;
		}
	});

	tree.addEventListener("click", (e) => {
		const li = (e.target as HTMLElement).closest<HTMLElement>(
			"li[role='treeitem']",
		);
		if (!li || !tree.contains(li)) return;
		focusItem(tree, li);
		if (li.hasAttribute("aria-expanded")) {
			toggle(li, li.getAttribute("aria-expanded") !== "true");
		} else {
			activate(tree, li);
		}
	});
}

function visibleItems(tree: HTMLElement): HTMLElement[] {
	const items: HTMLElement[] = [];
	function walk(parent: Element) {
		for (const child of parent.children) {
			if (!(child instanceof HTMLElement)) continue;
			if (child.getAttribute("role") !== "treeitem") continue;
			items.push(child);
			if (child.getAttribute("aria-expanded") === "true") {
				const group = child.querySelector<HTMLElement>(
					":scope > ul, :scope > [role='group']",
				);
				if (group) walk(group);
			}
		}
	}
	walk(tree);
	return items;
}

function parentTreeItem(item: HTMLElement): HTMLElement | null {
	let node: HTMLElement | null = item.parentElement;
	while (node && node.getAttribute("role") !== "treeitem") {
		node = node.parentElement;
	}
	return node;
}

function focusItem(tree: HTMLElement, item: HTMLElement | null | undefined) {
	if (!item) return;
	for (const i of tree.querySelectorAll<HTMLElement>("li[role='treeitem']")) {
		i.setAttribute("tabindex", "-1");
	}
	item.setAttribute("tabindex", "0");
	item.focus();
}

function toggle(item: HTMLElement, expand: boolean) {
	item.setAttribute("aria-expanded", expand ? "true" : "false");
	item.dispatchEvent(
		new CustomEvent("toggle", {
			bubbles: true,
			detail: { expanded: expand, item },
		}),
	);
}

function activate(tree: HTMLElement, item: HTMLElement) {
	tree.dispatchEvent(
		new CustomEvent("activate", {
			detail: { item, value: item.dataset.value },
		}),
	);
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

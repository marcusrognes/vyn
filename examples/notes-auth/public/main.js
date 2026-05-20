import { createApp, html, render } from "/_vyn/client.js";

const { rpc, cache } = createApp({});
const main = document.getElementById("main");
const nav  = document.getElementById("nav");

let currentUser = null;

function escape(s) {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function refreshUser() {
	currentUser = await rpc.auth.me.query({});
	render(nav, currentUser
		? html`<span>${currentUser.email}</span> <button id="logout" class="ghost">Sign out</button>`
		: html`<button id="show-login" class="ghost">Sign in</button>`);
	if (currentUser) document.getElementById("logout").addEventListener("click", logout);
	else document.getElementById("show-login").addEventListener("click", showAuth);
}

async function logout() {
	await rpc.auth.logout.mutate({});
	await refreshUser();
	showAuth();
}

function showAuth() {
	render(main, html`
		<h2>Sign in or create an account</h2>
		<form id="auth-form">
			<input name="email" type="email" placeholder="email@example.com" required>
			<input name="password" type="password" placeholder="at least 8 chars" minlength="8" required>
			<div style="display:flex; gap:0.5rem">
				<button type="submit" data-action="login">Sign in</button>
				<button type="submit" class="ghost" data-action="signup">Create account</button>
			</div>
			<p id="auth-error" style="color: #b91c1c; margin: 0"></p>
		</form>
	`);
	document.getElementById("auth-form").addEventListener("submit", async (e) => {
		e.preventDefault();
		const form = e.target;
		const action = e.submitter.dataset.action;
		const data = Object.fromEntries(new FormData(form));
		try {
			await rpc.auth[action].mutate(data);
			await refreshUser();
			showNotes();
		} catch (err) {
			document.getElementById("auth-error").textContent = err.message;
		}
	});
}

async function showNotes() {
	render(main, html`
		<form id="add-note">
			<input name="title" placeholder="Title" required>
			<textarea name="body" placeholder="Body"></textarea>
			<button type="submit">Create note</button>
		</form>
		<ul id="notes"></ul>
	`);
	const notesUl = document.getElementById("notes");

	function paint(notes) {
		render(notesUl, notes.map((n) => html`
			<li class="note" data-id="${n._id}">
				<h3>${escape(n.title)}</h3>
				<p>${escape(n.body)}</p>
				<button class="ghost" data-remove="${n._id}">Delete</button>
			</li>
		`));
	}

	const initial = await rpc.notes.list.query({});
	cache.set(rpc.notes.list, {}, initial);
	cache.subscribe(rpc.notes.list, paint, {});
	paint(initial);

	rpc.notes.onChanged.listen({}, {
		onValue(event) {
			cache.patch(rpc.notes.list, (list) => {
				if (!list) list = [];
				switch (event.kind) {
					case "added":   return [event.note, ...list];
					case "updated": return list.map((n) => n._id === event.note._id ? event.note : n);
					case "removed": return list.filter((n) => n._id !== event.note._id);
					default:        return list;
				}
			}, {});
		},
	});

	document.getElementById("add-note").addEventListener("submit", async (e) => {
		e.preventDefault();
		const form = e.target;
		const data = Object.fromEntries(new FormData(form));
		await rpc.notes.create.mutate(data);
		form.reset();
	});

	notesUl.addEventListener("click", async (e) => {
		if (e.target.dataset.remove) {
			await rpc.notes.remove.mutate({ _id: e.target.dataset.remove });
		}
	});
}

await refreshUser();
if (currentUser) await showNotes();
else showAuth();

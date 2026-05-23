// SQLite helper — copied into this app from the docs recipe.
// Vyn is bring-your-own-db; this is one shape. Wraps node:sqlite
// (Deno 2 exposes it natively) with a `{ _id, data }` JSON table
// convention plus typed Collection helpers.

import { DatabaseSync, type StatementSync } from "node:sqlite";

export type DbHandle = {
	db:         DatabaseSync;
	close():    void;
	collection<T extends { _id: string | number }>(table: string): Collection<T>;
};

export type Collection<T extends { _id: string | number }> = {
	insert(row: T): T;
	find(filter?: Partial<T>): T[];
	get(id: T["_id"]): T | undefined;
	update(id: T["_id"], patch: Partial<T>): T | undefined;
	delete(id: T["_id"]): boolean;
	count(filter?: Partial<T>): number;
	raw: DatabaseSync;
};

export function openSqlite(filename: string): DbHandle {
	const db = new DatabaseSync(filename);

	function collection<T extends { _id: string | number }>(table: string): Collection<T> {
		// Tables in this convention are { _id PRIMARY KEY, data JSON }
		db.exec(`CREATE TABLE IF NOT EXISTS ${q(table)} (_id TEXT PRIMARY KEY, data TEXT NOT NULL)`);

		const insertStmt = db.prepare(`INSERT INTO ${q(table)} (_id, data) VALUES (?, ?)`);
		const updateStmt = db.prepare(`UPDATE ${q(table)} SET data = ? WHERE _id = ?`);
		const getStmt    = db.prepare(`SELECT data FROM ${q(table)} WHERE _id = ?`);
		const deleteStmt = db.prepare(`DELETE FROM ${q(table)} WHERE _id = ?`);
		const allStmt    = db.prepare(`SELECT data FROM ${q(table)}`);
		const countStmt  = db.prepare(`SELECT COUNT(*) AS n FROM ${q(table)}`);

		function matches(row: T, filter: Partial<T>): boolean {
			for (const [k, v] of Object.entries(filter)) {
				if ((row as any)[k] !== v) return false;
			}
			return true;
		}

		return {
			raw: db,

			insert(row) {
				insertStmt.run(String(row._id), JSON.stringify(row));
				return row;
			},

			find(filter = {}) {
				const all = allStmt.all() as { data: string }[];
				const parsed = all.map((r) => JSON.parse(r.data) as T);
				if (Object.keys(filter).length === 0) return parsed;
				return parsed.filter((r) => matches(r, filter));
			},

			get(id) {
				const row = getStmt.get(String(id)) as { data: string } | undefined;
				return row ? (JSON.parse(row.data) as T) : undefined;
			},

			update(id, patch) {
				const row = this.get(id);
				if (!row) return undefined;
				const next = { ...row, ...patch };
				updateStmt.run(JSON.stringify(next), String(id));
				return next;
			},

			delete(id) {
				const r = deleteStmt.run(String(id));
				return (r.changes ?? 0) > 0;
			},

			count(filter = {}) {
				if (Object.keys(filter).length === 0) {
					const r = countStmt.get() as { n: number };
					return r.n;
				}
				return this.find(filter).length;
			},
		};
	}

	return {
		db,
		close: () => db.close(),
		collection,
	};
}

function q(name: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`unsafe table name: ${name}`);
	return `"${name}"`;
}

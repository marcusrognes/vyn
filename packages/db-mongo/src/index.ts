// @vynjs/db-mongo — thin convenience wrapper over the official `mongodb`
// driver. Apps install `mongodb` themselves (peer dep) so we don't pin
// a version.

import type { MongoClient as MongoClientType, Db as DbType, Collection as MongoCollection } from "mongodb";

export type MongoHandle = {
	client: MongoClientType;
	db:     DbType;
	collection<T extends Record<string, unknown>>(name: string): MongoCollection<T>;
	close(): Promise<void>;
};

export async function openMongo(url: string, dbName: string): Promise<MongoHandle> {
	const { MongoClient } = await import("mongodb");
	const client = new MongoClient(url);
	await client.connect();
	const db = client.db(dbName);
	return {
		client,
		db,
		collection: <T extends Record<string, unknown>>(name: string) => db.collection<T>(name),
		close:      async () => { await client.close(); },
	};
}

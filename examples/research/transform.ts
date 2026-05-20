import superjson from "superjson";
import type { Transformer } from "@vyn/server";

export const transformer: Transformer = {
	serialize:   (v) => superjson.serialize(v),
	deserialize: (v) => superjson.deserialize(v as any),
};

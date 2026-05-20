import { createRpcClient, type RpcClient, type ClientOpts } from "./rpc.ts";
import { Cache } from "./cache.ts";

export function createApp<R = unknown>(opts: ClientOpts = {}): { rpc: RpcClient<R>; cache: Cache } {
	return {
		rpc:   createRpcClient<R>(opts),
		cache: new Cache(),
	};
}

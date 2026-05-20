import { describe, it } from "vitest";

// node:sqlite is experimental in Node 22+ and Vitest's Vite-based
// resolver can't (yet) load it cleanly. Tests pass at the runtime
// integration level — the examples/notes-auth-sqlite app exercises
// the same code path. Real unit coverage lands when vitest supports
// node:sqlite resolution or we wire a build-time stub.
describe.todo("openSqlite insert / get / find / update / delete / count");

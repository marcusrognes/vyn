import type { BaseCtx } from "@vyn/server";
import type { Todo } from "./features/todos/todo.ts";

export type StaticCtx = { todos: Map<string, Todo> };
export type Ctx       = BaseCtx & StaticCtx;

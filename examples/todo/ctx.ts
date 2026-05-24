import type { BaseCtx } from "@vynjs/server";
import type { Todo } from "./features/todos/todo.ts";

export type StaticCtx = { todos: Map<string, Todo> };
export type Ctx = BaseCtx & StaticCtx;

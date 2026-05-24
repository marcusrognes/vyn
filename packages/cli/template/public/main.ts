// Boot the SPA. Both gen barrels:
//   _vyn.client.gen.ts → registers every *.component.ts under public/
//   _vyn.gen.ts        → routes table (HTML views + lazy controllers)

import "../_vyn.client.gen.ts";
import { createRouter } from "@vynjs/client";
import { routes } from "../_vyn.gen.ts";

createRouter({
	mount:  "#app",
	routes: [...routes],
	notFound: '<section class="card"><header class="card-head"><h2>404 — Not found</h2><p class="hint">No route matched. <a href="/">Go home →</a></p></header></section>',
});

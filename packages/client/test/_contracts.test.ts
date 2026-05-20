import { describe, it } from "vitest";

describe.todo("createApp<AppRouter>() returns { rpc, cache } typed against the router");

describe.todo("rpc.<path>.query(input) — POSTs, returns typed result, throws RpcError on category failure");
describe.todo("rpc.<path>.mutate(input) — POSTs, returns typed result");
describe.todo("rpc.<path>.listen(input, handlers) — opens WS subscription, returns unsubscribe");
describe.todo("rpc.<path>.iterate(input) — async iterator over yielded values");

describe.todo("cache.patch(query, fn) — applies fn to cached entry; fires subscribers");
describe.todo("cache.subscribe(query, fn) — fires fn on every cache change for that query");
describe.todo("cache.set(query, params, value) — direct write");

describe.todo("useQuery — opens subscription for invalidateOn / updateOn for its lifetime");
describe.todo("useQuery({ invalidateOn }) — refetches when listed subscriptions emit");
describe.todo("useQuery({ updateOn }) — applies updater function on emit, no refetch");

describe.todo("signal() — synchronous read, write notifies subscribers");
describe.todo("signal.subscribe(fn) — fires fn on every change, returns unsub");

describe.todo("html`...` tagged template — returns Html sentinel, escapes interpolated strings, passes nested Html through unescaped");
describe.todo("render(el, html`...`) — sets el.innerHTML to the Html sentinel's source");
describe.todo("component(setup) — registers custom element, runs setup on connect");

describe.todo("getLoaderData() — reads the inlined __fw_loader JSON from SPA shell");
describe.todo("useParams(pattern) — typed param read from current URL");

describe.todo("Router — file-based route discovery from public/routes/, <a-route> custom elements");
describe.todo("Router — _layout.html composes parent layouts onto child routes");
describe.todo("Router — _404.html / _error.html fallbacks");

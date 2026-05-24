# sandbox

Local dogfood target. Wires every `@vynjs/*` import to the workspace's on-disk source instead of `jsr:@vynjs/*`, so you can edit any package
in `../../packages/` and reload here without publishing.

```sh
cd examples/sandbox
deno task dev
```

Open http://localhost:8000.

Edit `../../packages/core/src/v.ts` (or any other source) → save → `--watch` restarts the server. Browser bundle is rebuilt on the next
request to `/main.js`.

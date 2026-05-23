# create-vyn

Scaffolder for [Vyn](https://github.com/marcusrognes/vyn) apps.

```sh
deno create npm:vyn my-app
# or
npm create vyn@latest my-app
```

Drops a starter project (`deno.json`, `server.ts`, `public/`) into
`my-app/`. Then:

```sh
cd my-app
deno task dev
```

Requires Deno 2 or newer. Install from https://deno.com/install.

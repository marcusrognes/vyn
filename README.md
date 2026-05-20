# Vyn

A small full-stack TypeScript framework. Runs on Deno or Node.

The point: every layer small enough to read in one sitting. No build
tooling on top of the runtime's own. No magic. No hidden control flow.

This repo is the monorepo: framework packages live under `packages/`,
docs live under `docs/`. The docs site is the spec — code blocks are
extracted and run on both runtimes to prove parity.

## Layout

```
packages/        framework packages (core, client, server, auth, cli, runtime-*)
docs/            documentation site (Astro Starlight)
examples/        runnable example apps, one per runtime
```

## Working on docs

```bash
npm install
npm run docs:dev    # localhost:4321
```

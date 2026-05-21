# Publishing Vyn

Every package under `packages/` is publishable to npm under the
`@vyn` scope. The repo ships a `prepublishOnly` script per package
that builds the `dist/` artifact before publishing.

## One-shot local publish

```sh
# 1. Build everything
npm run build

# 2. Smoke-test the artifacts
node -e "import('./packages/core/dist/index.js').then(m => console.log(Object.keys(m).length, 'exports'))"

# 3. Bump versions across all packages
npm version 0.2.0 --workspaces --no-git-tag-version

# 4. Publish (uses publishConfig.access = public)
npm run publish:all
```

`publish:all` walks every workspace with an `--if-present` filter
so docs + examples don't trigger publish.

## Per-package publish

```sh
cd packages/core
npm version patch --no-git-tag-version
npm publish
```

## CI publish on tag

`.github/workflows/release.yml` triggers on `v*.*.*` tags:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The workflow installs, tests, builds, and runs `npm publish` against
each `packages/*/` directory with provenance enabled (OIDC). Requires
the `NPM_TOKEN` repository secret with the `@vyn` scope's publish
permission.

## What ships in each tarball

| Package | Files |
|---|---|
| `@vyn/core`         | `dist/`, `src/`, `README.md` |
| `@vyn/server`       | `dist/`, `src/`, `README.md` |
| `@vyn/client`       | `dist/`, `src/`, `browser.js`, `README.md` |
| `@vyn/auth`         | `dist/`, `src/`, `README.md` |
| `@vyn/cli`          | `dist/`, `src/`, `README.md` (binary at `dist/index.js`) |
| `@vyn/ui`           | `dist/`, `src/`, `browser.js`, `README.md` |
| `@vyn/db-sqlite`    | `dist/`, `src/`, `README.md` |
| `@vyn/db-mongo`     | `dist/`, `src/`, `README.md` |
| `@vyn/notify-inbox` | `dist/`, `src/`, `README.md` |

Source `.ts` files ship alongside compiled `.js` + `.d.ts` so
downstream debuggers can step into the original code; production
consumers ignore the source via standard `main` / `exports`
resolution.

## Versioning

Pre-1.0: bump together. Use a single `npm version 0.X.0
--workspaces` command so every package stays in lockstep until the
API stabilises. After 1.0: bump packages independently using
patch / minor / major as per semver.

## Internal workspace deps

`@vyn/server` depends on `@vyn/core` via `"@vyn/core": "*"`. npm
rewrites the `*` to the actual published version during
`npm publish`. No special action required at publish time.

## First-time setup

1. Create an `@vyn` org on npm (or use your account's namespace).
2. Generate an automation token with publish access.
3. Add `NPM_TOKEN` as a GitHub Actions secret on the repo.
4. Push a `v*.*.*` tag to trigger the workflow.

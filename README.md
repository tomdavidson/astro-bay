# astro-bay

Monorepo of independently published [Astro](https://astro.build) integrations and the
ESLint configs that support them. Each package has its own version, changelog, and npm
release.

## Packages

| Package                          | Purpose                                                                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@astro-bay/content-hub`         | Aggregates Astro content collections into a normalized hub. Handles topic taxonomies, alias redirects, injected article and topic routes, Pagefind attributes, and JSON-LD output (`BlogPosting`, `DefinedTerm`, `CollectionPage` with SKOS `broader`/`narrower`). |
| `@astro-bay/jsonld`              | Provider interface other plugins implement to contribute structured data during `astro:build:done`.                                                                                                                                                                |
| `@astro-bay/eslint-config`       | Flat ESLint config for TypeScript. Boundary enforcement, functional rules, oxlint dedup.                                                                                                                                                                           |
| `@astro-bay/eslint-config-astro` | Flat ESLint config for `.astro` files. Treats them as the view layer with relaxed FP rules and structural limits.                                                                                                                                                  |

Source layout:

- `plugins/` — published Astro integrations
- `packages/` — ESLint configs and shared utilities
- `apps/`, `website/` — internal consumers, not published

## Installing a plugin

Each plugin is a standard Astro integration. Install only what you need.

```ts
// astro.config.ts
import contentHub from '@astro-bay/content-hub'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    contentHub({
      collections: ['vault', 'feed'],
      permalinks: { articleBase: 'articles' },
      taxonomy: { route: 'topics', indexPage: true },
      browse: { pageSize: 20 },
    }),
  ],
})
```

Full options are documented in each plugin's README.

## Conventions

The plugins are written to a consistent style. Relevant for contributors and for anyone
reading the source:

- Functional TypeScript. No `class`, `this`, `let`, `throw`, or `try` in domain or app
  code. Errors are returned as `Result` via `neverthrow`.
- Layer suffixes: `.domain.ts`, `.app.ts`, `.infra.ts`. IO is restricted to `.infra.ts`
  and `.astro` files, enforced by `eslint-plugin-boundaries`.
- `readonly` by default on types and arrays.
- Configuration errors (UID collisions, invalid routes, duplicate hub names) fail at
  `astro:config:setup`, not at runtime.
- Hub data is computed once per build and cached at module level.

Reference docs in the repo: `toms-clean-code.md`, `toms-clean-arch.md`,
`lang-typescript.md`, `testing.md`, `testing-typescript.md`.

## Development

Toolchain is pinned in `.moon/toolchains.yml` and installed via proto:

- Node 22.22.1
- pnpm 10.32.1
- Bun 1.3.10
- moon, proto

```bash
proto install
pnpm install
moon run :build
moon run :test --affected
moon run :lint --affected
moon run :fmt-check
```

Per-project tasks:

- `moon run <project>:test` — vitest
- `moon run <project>:publish` — release via release-please
- `moon run :sync-release` — sync `release-please-config.json` with current projects
- `moon run :fmt` — dprint format

Releases use release-please per package. Conventional commit scopes are auto-discovered
from `.moon/workspace.yml`, so new projects work with commit validation as soon as they
are added.

## Adding a plugin

```bash
moon generate astro-plugin
```

The template prompts for name, description, content collection usage, and route injection.
Output passes lint, format, and boundary rules out of the box.

Next steps after generation:

1. Implement Astro hooks in `src/infra/integration.ts`.
2. Put domain logic in `.domain.ts` files as pure functions returning `Result`.
3. Add vitest specs next to source as `*.spec.ts`. fast-check is available for property
   tests.
4. Add a `fuzz-ci` task only if the plugin parses untrusted input.

## CI

- Formatter is dprint. CI fails on `dprint check`.
- Linting runs oxlint then ESLint. Both must pass.
- PR titles must be conventional commits with a scope matching a project ID.
- Moon affected detection drives test and lint runs. Keep `moon.yml` task inputs accurate
  or tasks will be skipped when they shouldn't be.

## License

MIT, per package. See individual `package.json` files.

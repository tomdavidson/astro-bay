# astro-bay

A shared repo of [Astro](https://astro.build) plugins and integrations. Each plugin has its own independent lifecycle.


## Plugins

| Plugin | Description | Status |
|---|---|---|
| `@astro-bay/content-hub` | Aggregates content from multiple sources, normalizes entries, builds taxonomy pages, generates permalinks with alias redirects, and emits Pagefind metadata. The orchestrator. | In progress |
| `@astro-bay/jsonld` | Emits JSON-LD structured data as sibling `.jsonld` files per route. Ships an LDES change feed, type index, and SSR content negotiation middleware. | In progress |
| `@astro-bay/taxonomy` | Hierarchical topic graph with DAG validation, synonym resolution, and virtual module for build-time access. Useful for any Astro site with tags. | In progress |
| `@astro-bay/pagefind-resolve` | Smart 404 recovery using Pagefind index lookups with configurable scoring thresholds. | Planned |
| `@astro-bay/taxonomy-enrich` | CLI tool for ONNX/WordNet-powered taxonomy enrichment. Separate package to keep `astro-taxonomy` lightweight. | Planned |

## Architecture

All by the simiplest of plugins follow a layered layered architecture:

- **Domain** (`.domain.ts`) — Pure functions, readonly types, `neverthrow` Result types. No IO, no classes, ect..
- **Infrastructure** (`.infra.ts`) — Astro hooks, file system, network. Imperative shell around the functional core.
- **Tests** (`.spec.ts`) — Co-located with source. Vitest with fast-check property tests.

## Toolchain

| Tool | Purpose |
|---|---|
| [Moon](https://moonrepo.dev) | Task runner, project graph, CI orchestration |
| [Proto](https://moonrepo.dev/proto) | Toolchain version management |
| [pnpm](https://pnpm.io) | Package manager (v10) |
| [dprint](https://dprint.dev) | Code formatter (TypeScript, JSON, Markdown, YAML, HTML) |
| [oxlint](https://oxc.rs) | Fast linter (correctness, complexity, type safety) |
| [ESLint](https://eslint.org) | Functional programming rules, boundary enforcement |
| [Vitest](https://vitest.dev) | Test runner with in-source testing support |
| [Bun](https://bun.sh) | Test execution runtime |

## Getting Started

### Prerequisites

Install [Proto](https://moonrepo.dev/proto) (manages Node, pnpm, Bun, and Moon versions automatically):

```bash
curl -fsSL https://moonrepo.dev/install/proto.sh | bash
```

### Setup

```bash
git clone https://github.com/tomdavidson/astro-bay.git
cd astro-bay
moon setup
```

This installs all toolchain versions defined in `.prototools` and runs `pnpm install`.

### Common Tasks

```bash
moon run :lint          # Lint all projects
moon run :test          # Test all projects
moon run :check-type    # Typecheck all projects
moon run :fmt           # Format everything
moon run :fmt-check     # Verify formatting (CI)
moon run :audit         # Security audit (OSV, Cargo, Gitleaks)
```

Run tasks for a specific plugin:

```bash
moon run astro-jsonld:test
moon run astro-taxonomy:lint
```

Run only affected tasks (compares against default branch):

```bash
moon run :test --affected
```

### Scaffolding a New Plugin

```bash
moon generate astro-plugin
```

Prompts for plugin name, description, and feature flags (content layer support, injected pages).

## CI/CD

Trunk-based development on `main`. PRs run the full CI pipeline (lint, test, typecheck, audit, CodeQL).
Merges to `main` trigger [Release Please](https://github.com/googleapis/release-please) for versioning
and automated npm publishing with OIDC provenance.

| Workflow | Trigger | Purpose |
|---|---|---|
| `pr.yml` | Pull request | CI gate (Moon CI, audit, CodeQL) |
| `main.yml` | Push to main | CI, then release-please, then publish |
| `publish.yml` | Called by main | Publish to npm with provenance |
| `pr-fuzz.yml` | `fuzz` label or dispatch | Fuzz saturation on PR branches |
| `main-fuzz.yml` | Weekly schedule or dispatch | Long-running fuzz on main, auto-PR for regressions |

## Project Structure

```
astro-bay/
├── .github/
│   ├── actions/         # Reusable composite actions (setup, moon-ci, etc.)
│   └── workflows/       # CI/CD workflows
├── .moon/
│   ├── tasks/           # Shared task definitions (typescript.yml, astro.yml)
│   ├── templates/       # Code generation templates
│   ├── toolchains.yml   # Node, pnpm, Bun, Proto versions
│   └── workspace.yml    # Project discovery and VCS config
├── plugins/
│   ├── astro-content-hub/
│   ├── astro-jsonld/
│   └── astro-taxonomy/
├── dprint.json           # Formatter config
├── eslint.config.mjs     # FP rules + boundary enforcement
├── oxlintrc.json         # Fast linter config with layer overrides
└── moon.yml              # Root tasks (fmt, fmt-check)
```

## License

MIT

# @astro-bay/pagefind-resolve

Client-side 404 resolution powered by Pagefind.

When a visitor lands on a dead URL, renamed slug, or stale backlink, this package turns the pathname
into a Pagefind query, searches the generated index, then either redirects to the best match or
renders suggestions on the 404 page.

This package is a companion to `astro-pagefind`. It does not create the search index, ship a search
UI, or replace your content routing.

## How it works

1. Visitor lands on a missing page. The server sends a `404` HTTP response. The page renders
   normally.
2. JavaScript runs client-side after page load.
3. The client turns the pathname into a search query.
4. Pagefind returns ranked matches from the local static index.
5. The package reweights those matches using URL-path similarity.
6. If one result clearly wins, the visitor is redirected.
7. If results are ambiguous, the package shows suggestions.
8. Each outcome emits a structured log event and a typed DOM `CustomEvent`.

> **Client-side only.** This is a client-side recovery layer. The initial HTTP `404` has already
> been returned by the server before any JavaScript runs. Users with JavaScript disabled will see
> the static 404 page without any resolution. Future work may capture redirect logs server-side to
> promote recurring matches into permanent server-level redirects.

## Install

```bash
pnpm add @astro-bay/pagefind-resolve
```

Peer dependencies:

- `astro >= 5`
- `astro-pagefind >= 1`

## Quick start

Use the component inside your existing `src/pages/404.astro` page.

```astro
---
import Layout from '../layouts/BaseLayout.astro'
import Resolve404 from '@astro-bay/pagefind-resolve/components'
---

<Layout title="Page not found">
  <h1>Page not found</h1>
  <Resolve404 stripBases={['articles']} />
</Layout>
```

That is enough to enable smart 404 resolution once your site is building a Pagefind index.

## Props

| Prop                         | Type                            | Default                   | Purpose                                                              |
| ---------------------------- | ------------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `scoreThreshold`             | `number`                        | `0.55`                    | Minimum top score required before redirect is considered             |
| `redirectDominanceFactor`    | `number`                        | `1.25`                    | How much the top result must dominate the second                     |
| `maxSuggestions`             | `number`                        | `5`                       | Max suggestions shown when redirect confidence is too low            |
| `stripBases`                 | `string[]`                      | `[]`                      | Path prefixes to strip before searching, e.g. `['articles', 'blog']` |
| `searchRoute`                | `string`                        | `'/search'`               | Fallback search page route                                           |
| `logLevel`                   | `'debug' \| 'info' \| 'silent'` | `'info'`                  | Logging verbosity                                                    |
| `urlPathWeight`              | `number`                        | `0.8`                     | Weight given to URL-path similarity during reweighting               |
| `minUrlPathScoreForRedirect` | `number`                        | `0.45`                    | Minimum URL similarity required before an automatic redirect         |
| `pagefindPath`               | `string`                        | `'/pagefind/pagefind.js'` | Path to the Pagefind JS entry point                                  |
| `class`                      | `string`                        | `undefined`               | Additional class for the root element                                |

## Example config

These are the defaults. They are a reasonable starting point, not a contract. Adjust them to match
your site's content structure and acceptable redirect confidence.

```ts
const exampleConfig = {
  scoreThreshold: 0.55, // raise if you see false-positive redirects
  redirectDominanceFactor: 1.25, // raise for more conservative redirects
  maxSuggestions: 5,
  stripBases: [], // e.g. ['articles', 'blog'] for prefix stripping
  searchRoute: '/search',
  logLevel: 'info',
  urlPathWeight: 0.8, // 80% URL similarity, 20% content relevance
  minUrlPathScoreForRedirect: 0.45,
  pagefindPath: '/pagefind/pagefind.js',
}
```

The `pagefindPath` default matches the standard `astro-pagefind` output location. Override it if you
use a non-standard site base or output directory.

## How the resolution works

The package is split into small, focused modules.

- `path.ts` converts a pathname into a query string.
- `url.ts` tokenizes paths and scores URL similarity.
- `scoring.ts` blends Pagefind relevance with URL-path similarity.
- `resolve.ts` applies the final redirect-or-suggestions policy.
- `client/shell.ts` is the browser shell that wires Pagefind, DOM updates, events, and redirects.

### Redirect policy

A redirect happens only when both gates pass:

1. The top result is confident enough: it clears `scoreThreshold` and dominates the second result by
   `redirectDominanceFactor`.
2. The top result URL still resembles the query: it passes `minUrlPathScoreForRedirect`.

The second gate is important. It prevents a body-content match like `/contact` from stealing an
automatic redirect meant for `/about`.

## Using the pure API directly

```ts
import {
  type PagefindResult,
  pathToQuery,
  type ResolveConfig,
  resolveResults,
  reweightResults,
} from '@astro-bay/pagefind-resolve'

const query = pathToQuery('/articles/about-our-work', ['articles'])

const results: ReadonlyArray<PagefindResult> = [{ url: '/about', score: 0.82, title: 'About' }, {
  url: '/our-work',
  score: 0.79,
  title: 'Our Work',
}]

const reweighted = reweightResults(results, query, 0.8)

const config: ResolveConfig = {
  scoreThreshold: 0.55,
  redirectDominanceFactor: 1.25,
  maxSuggestions: 5,
  minUrlPathScoreForRedirect: 0.45,
}

const outcome = resolveResults(reweighted, query, config)
```

## Logging

Each resolution emits a structured event object as a plain object. The logger does not stringify the
payload, so browser tools and console collectors can inspect it as structured data.

### Redirect

```ts
{
  event: 'pagefind-resolve.redirect',
  from: '/articles/old-slug',
  to: '/articles/new-slug',
  score: 0.91,
  query: 'old slug',
  title: 'New Article',
  timestamp: '2026-04-01T16:00:00.000Z',
}
```

### Suggestions

```ts
{
  event: 'pagefind-resolve.suggestions',
  from: '/about-our-work',
  query: 'about our work',
  count: 3,
  topScore: 0.74,
  timestamp: '2026-04-01T16:00:00.000Z',
}
```

### No results

```ts
{
  event: 'pagefind-resolve.no-results',
  from: '/gone-page',
  query: 'gone page',
  timestamp: '2026-04-01T16:00:00.000Z',
}
```

## DOM event

The component dispatches a typed `pfr:resolve` `CustomEvent` from its root element on every
resolution outcome.

```ts
import type { PfrResolveEvent } from '@astro-bay/pagefind-resolve'

document.addEventListener('pfr:resolve', (e: Event) => {
  const event = e as PfrResolveEvent
  if (event.detail.event === 'pagefind-resolve.redirect') {
    console.log('Redirecting to', event.detail.to)
  }
})
```

The `PfrResolveDetail` type is a discriminated union — use `event.detail.event` to narrow to the
specific outcome.

## Styling hooks

The component renders unstyled semantic markup. These classes are stable hooks for your own CSS.

- `.pfr-resolve`
- `.pfr-status`
- `.pfr-suggestions`
- `.pfr-search-link`

## Architecture

This package follows a functional core, imperative shell split.

- Pure core: `path.ts`, `url.ts`, `scoring.ts`, `resolve.ts`, `logging.ts`
- Imperative shell: `client/shell.ts`
- Astro adapter: `components/Resolve404.astro`

The pure modules are small and independently testable. The client shell owns browser-only concerns:
dynamic imports, DOM mutation, events, and redirects. No business logic lives in the shell.

## Testing

The package follows small-file, co-located testing per the TypeScript testing conventions.

- Each source file contains only in-file tests (`import.meta.vitest`) for functions defined in that
  file.
- Layer 1: in-file tests for pure functions with no cross-file dependencies.
- Layer 2 (future): integration tests in `src/tests/` for cross-module composition.
- Slow property tests (fast-check) use `test.skipIf(tdd)` and are excluded from watch mode.
- Shared arbitraries live in `src/test/arbitraries.ts`.
- Shared test data builders live in `src/test/builders.ts`.

Scripts:

```bash
pnpm test          # full suite
pnpm run test:tdd  # watch mode, slow tests skipped
pnpm run typecheck
```

## Notes

- This is a client-side recovery layer, not a replacement for permanent redirects.
- High-confidence recurring matches should eventually become real redirects in your host or
  framework config.
- The `pagefindPath` option defaults to `/pagefind/pagefind.js`, matching the standard
  `astro-pagefind` output. Override if your site uses a custom base path.

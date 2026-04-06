Here is the complete updated README:

# @astro-bay/taxonomy

Derives, curates, and exposes a taxonomy graph as a shared virtual module for Astro integrations.
Content tagged with topics gets organized into a directed acyclic graph of parent/child
relationships and synonym groups, then served to every page in your site through a single import.

Designed for content-heavy Astro sites powered by Obsidian vaults, RSS/Atom feed imports, or any
content loader. The graph is consumed by other integrations (astro-content-hub, Pagefind,
@astrojs/rss, sitemaps) without owning any of their responsibilities.

## Install

```bash
pnpm add @astro-bay/taxonomy
```

Peer dependencies: `astro >=5.0.0`, `zod >=3.23.0`.

The only runtime dependency is `neverthrow` for typed error handling.

## Quick start

```ts
// astro.config.mjs
import astroTaxonomy from '@astro-bay/taxonomy'
import { fileProvider } from '@astro-bay/taxonomy/providers'
import { defineConfig } from 'astro'

export default defineConfig({
  integrations: [astroTaxonomy({ providers: [fileProvider({ path: './taxonomy.json' })] })],
})
```

Import the resolved graph anywhere in your Astro site:

```ts
import { edges, graph, labels, synonyms } from '@astro-bay/taxonomy:graph'
```

TypeScript types are injected automatically via `injectTypes`. No manual `d.ts` setup needed.

## Use cases

### Obsidian vault publishing

An Obsidian vault with topic tags in frontmatter becomes a self-organizing knowledge base. Run
`derive` against the vault directory to discover topic clusters from co-occurrence patterns, then
curate the output into a committed taxonomy file.

### Feed aggregation

When ingesting external feeds via `@ascorbic/feed-loader` or similar, incoming entries carry topic
tags from upstream. The taxonomy graph normalizes synonyms (so "public transportation" and "public
transit" collapse to one canonical topic) and organizes flat tags into a browsable hierarchy.

### Multi-source content hubs

Sites that pull from multiple collections (vault notes, imported feeds, manually authored articles)
use the taxonomy as the shared spine. Each source contributes topics; the graph unifies them across
sources.

### Pagefind search with faceted topics

Pagefind indexes `data-pagefind-filter` attributes at build time. The taxonomy graph lets you emit
not just an article's direct topics but also their ancestors, so filtering by "Housing" surfaces
articles tagged "Rent Control" or "Affordable Housing." See the Pagefind section below.

### Breadcrumbs and related content

The `ancestors()` and `children()` helpers produce breadcrumb trails and "related topics" sections
from the graph without any manual linking.

## How it works

1. You configure one or more providers (file, content-derived, or custom).
2. At build start (and dev server start), each provider loads a `TaxonomyFragment` containing edges,
   synonyms, and optional rejections.
3. Fragments are composed in provider order. Later providers override earlier ones. Rejections
   permanently suppress edges.
4. The composed graph is validated for cycles (a cycle is a hard error).
5. The graph is exposed as a Vite virtual module, importable from any `.astro` page or component.

## Options

| Option          | Type                 | Default                       | Description                                                       |
| --------------- | -------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `providers`     | `TaxonomyProvider[]` | `[]`                          | Ordered list of providers. Later providers override earlier ones. |
| `virtualModule` | `string`             | `'@astro-bay/taxonomy:graph'` | Virtual module ID for the resolved graph.                         |
| `strict`        | `boolean`            | `false`                       | Throw on provider errors and cycles instead of logging warnings.  |

## Providers

### Built-in

| Provider                             | Purpose                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `fileProvider({ path })`             | Reads a curated JSON file. Supports an `optional` flag for first-run when the file doesn't exist yet.                                   |
| `contentDerivedProvider({ output })` | Reads a pre-derived file. Identical to `fileProvider` with `optional: true`. The file is written by the `derive` CLI, not by the build. |

Provider order matters. A typical setup:

```ts
astroTaxonomy({
  providers: [
    contentDerivedProvider({ output: './taxonomy.derived.json' }), // auto-derived base
    fileProvider({ path: './taxonomy.curated.json' }), // human overrides on top
  ],
})
```

The curated file loads second, so its edges and rejections take precedence over the derived file.

### Custom providers

Implement `TaxonomyProvider` to supply taxonomy data from any source:

```ts
import type { TaxonomyFragment, TaxonomyProvider } from '@astro-bay/taxonomy/types'

export const myProvider: TaxonomyProvider = {
  name: 'my-provider',
  watchPaths: ['./my-taxonomy-source.json'],

  async load(ctx) {
    // ctx.allTopics and ctx.topicLabels are available
    // when populated by earlier providers or content scanning
    const fragment: TaxonomyFragment = {
      edges: [{ parent: 'policy', child: 'housing-policy', source: 'external' }],
      synonyms: [{ canonical: 'housing', variants: ['homes', 'residences'] }],
      rejections: [],
    }
    return fragment
  },

  // Optional: persist the resolved graph back to a file
  async save(graph, ctx) {
    // write to disk, push to API, etc.
  },
}
```

### Third-party tagging and NLP providers

The `TaxonomyProvider` interface is the extension point for automated tagging engines. A provider
receives `TaxonomyContext` (the list of all known topics) and returns a `TaxonomyFragment` with
discovered edges and synonyms. The plugin does not ship NLP dependencies. Each engine is a separate
package that implements the interface.

Examples of what a third-party provider could do:

**OpenCalais / Google Cloud NLP / spaCy**: Sends article text to an entity extraction API, receives
topic classifications, and maps them to parent/child edges. The provider runs during the `derive`
step (not during builds) to avoid API calls on every deploy.

```ts
// Hypothetical: @astro-bay/taxonomy-provider-opencalais
import type { TaxonomyProvider } from '@astro-bay/taxonomy/types'

export const openCalaisProvider = (apiKey: string): TaxonomyProvider => ({
  name: 'opencalais',
  async load(ctx) {
    // Call OpenCalais with ctx.allTopics
    // Return discovered parent/child relationships
    return { edges: [...], synonyms: [...] }
  },
})
```

**Embedding-based clustering**: Computes vector embeddings for topic labels, clusters them by cosine
similarity, and proposes parent/child edges where one topic subsumes another.

**Wikidata / DBpedia lookup**: Resolves topic labels against a public knowledge graph and imports
the existing hierarchy as edges.

All third-party providers follow the same contract: implement `load()`, return a `TaxonomyFragment`.
The compose step handles merging, deduplication, cycle detection, and rejection filtering. The
provider only needs to produce edges and synonyms.

## The derive CLI

The `derive` command scans Markdown/MDX files, reads topic arrays from frontmatter, builds a
co-occurrence matrix, and writes a draft taxonomy file. This runs outside of Astro's build pipeline.

### Prerequisites

The CLI entry is a Node wrapper (`derive.js`) that tries Bun first, then falls back to tsx to run
the TypeScript implementation. You need one of them:

```bash
# Either have Bun installed globally, or:
pnpm add -D tsx
```

### Running

```bash
./node_modules/.bin/@astro-bay/taxonomy derive \
  --content ./vault \
  --content ./src/content/articles \
  --output taxonomy.derived.json \
  --field topics \
  --min-count 2
```

| Flag            | Default                 | Description                                                     |
| --------------- | ----------------------- | --------------------------------------------------------------- |
| `--content, -c` | (required)              | Content directory to scan. Repeatable for multiple directories. |
| `--output, -o`  | `taxonomy.derived.json` | Output file path.                                               |
| `--field, -f`   | `topics`                | Frontmatter field to read topic arrays from.                    |
| `--min-count`   | `2`                     | Minimum co-occurrence count to emit an edge.                    |

### Where to put the output

Place `taxonomy.derived.json` in your project root (next to `astro.config.mjs`). Commit it to
version control. The file is a starting point, not a final product. Review the derived edges, move
confirmed ones into `taxonomy.curated.json`, and add rejections for edges that should not exist.

A typical project root:

```text
astro.config.mjs
taxonomy.derived.json     # auto-generated, re-run derive to update
taxonomy.curated.json     # hand-edited, committed, never overwritten by derive
```

### Workflow

1. Run `derive` against your content directories.
2. Review `taxonomy.derived.json`. Edges are sorted by confidence score (highest first).
3. Move confirmed edges into `taxonomy.curated.json`. Add rejections for bad edges.
4. Re-run `derive` any time content changes significantly. The curated file's rejections prevent bad
   edges from reappearing.
5. Build your site. The providers load both files, curated wins on conflicts.

## Using with Pagefind

@astro-bay/taxonomy does not emit HTML or Pagefind-specific markup. It exposes pure functions that
your layout uses to generate the right attributes for Pagefind indexing.

### TaxonomyMeta component

Create a component in your site that emits Pagefind filter attributes from the graph:

```astro
***
// components/TaxonomyMeta.astro
import { graph } from '@astro-bay/taxonomy:graph'
import { ancestors, canonicalize, labelFor } from '@astro-bay/taxonomy'

const { topics = [] } = Astro.props
const resolved = topics.map((t: string) => canonicalize(t, graph))
const allLabels = [...new Set([
  ...resolved.map((t: string) => labelFor(t, graph)),
  ...resolved.flatMap((t: string) => ancestors(t, graph).map(a => a.label)),
])]
***
{allLabels.map(label => (
  <span data-pagefind-filter={`topic:${label}`} />
))}
```

### Article layout

```astro
***
import TaxonomyMeta from '../components/TaxonomyMeta.astro'
***
<article data-pagefind-body>
  <h1 data-pagefind-meta="title">{entry.data.title}</h1>
  <TaxonomyMeta topics={entry.data.topics} />
  <slot />
</article>
```

An article tagged `rent-control` automatically gets `Housing` as a filter value because the graph
knows the parent relationship. Pagefind's filter UI lets visitors filter by `Housing` and find all
articles in the subtree.

### Pagefind UI

Enable the topic filter in the search UI:

```js
new PagefindUI({ element: '#search', openFilters: ['topic'] })
```

### Synonym handling

`canonicalize()` resolves synonyms before emitting filter values. Articles tagged
`public-transportation` and `public-transit` both produce the same Pagefind filter entry. No
duplicate facets, no missed results.

## Using with astro-content-hub

astro-content-hub reads the graph via an optional import:

```ts
// Inside astro-content-hub's topic hub page
let graph = null
try {
  const mod = await import('@astro-bay/taxonomy:graph')
  graph = mod.graph
} catch {
  // @astro-bay/taxonomy not installed, fall back to flat topic list
}
```

When the graph is available, topic hub pages show breadcrumbs, child topics, and related topics.
When absent, the hub falls back to a flat alphabetical listing.

## Taxonomy file format

```json
{
  "edges": [
    { "parent": "housing", "child": "affordable-housing", "source": "curated" },
    { "parent": "housing", "child": "rent-control", "source": "derived", "confidence": 0.85 }
  ],
  "synonyms": [
    {
      "canonical": "public-transit",
      "variants": ["public-transportation", "mass-transit"],
      "source": "curated"
    }
  ],
  "rejections": [{ "parent": "courts", "child": "housing" }]
}
```

**Edges** define parent-child topic relationships. `confidence` is optional (0 to 1, set by the
derive step). `source` is metadata for tracking origin.

**Synonyms** map variant labels to a canonical slug. All variants resolve to the canonical form in
filters, URLs, and labels.

**Rejections** permanently suppress an edge. If the derive step proposes `courts -> housing` and you
reject it, that edge will never appear in the resolved graph regardless of how many times you
re-derive.

## Exported utilities

Pure functions importable from `@astro-bay/taxonomy` for use in layouts, components, and other
integrations:

| Function                            | Signature                                                       | Purpose                                         |
| ----------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| `ancestors(slug, graph)`            | `string, ResolvedGraph -> Array<{ slug, label }>`               | All ancestor topics (walk up the tree)          |
| `children(slug, graph)`             | `string, ResolvedGraph -> Array<{ slug, label }>`               | Direct child topics                             |
| `canonicalize(slug, graph)`         | `string, ResolvedGraph -> string`                               | Resolve synonyms to canonical slug              |
| `labelFor(slug, graph)`             | `string, ResolvedGraph -> string`                               | Human-readable label for a topic slug           |
| `slugifyTopic(raw)`                 | `string -> string`                                              | Normalize a raw topic string to a URL-safe slug |
| `buildCoOccurrenceMatrix(entries)`  | `Array<{ topics }> -> CoOccurrenceMatrix`                       | Build co-occurrence counts from tagged entries  |
| `topCoOccurrences(slug, matrix, n)` | `string, CoOccurrenceMatrix, number -> Array<{ slug, count }>`  | Top N co-occurring topics                       |
| `composeFragments(results)`         | `Array<ProviderResult> -> Result<ResolvedGraph, TaxonomyError>` | Compose fragments with cycle detection          |

## Project structure

```text
src/
  types.ts              # Shared domain types (no logic)
  config.ts             # Option types, defaults, mergeConfig
  slugify.ts            # Topic slug normalization
  graph.ts              # Graph construction, cycle detection, query helpers
  cooccurrence.ts       # Co-occurrence matrix builder
  compose.ts            # Multi-provider fragment composition
  virtual.ts            # Vite virtual module plugin
  integration.ts        # Astro integration entry (imperative shell)
  index.ts              # Public API barrel
  bin/
    derive.js           # CLI wrapper (tries Bun, falls back to tsx)
    derive.ts           # Derive command implementation
  providers/
    file.ts             # File-based provider (read/write JSON)
    contentDerived.ts   # Thin wrapper over fileProvider for derived files
    index.ts            # Provider barrel
  test/
    setup.ts            # fast-check global config
    builders.ts         # Test data factories
    arbitraries.ts      # fast-check arbitraries
    helpers.ts          # expectOk/expectErr Result assertion helpers
```

Functional core, imperative shell. All domain logic (graph, slugify, cooccurrence, compose) is pure
functions with no IO. The shell (integration.ts, providers, bin) handles file reads, Astro hooks,
and CLI concerns. In-file tests via `import.meta.vitest` sit at the bottom of every pure module.

## Testing

```bash
pnpm test          # full suite: unit + property tests
pnpm run test:tdd  # watch mode, slow property tests skipped
pnpm run typecheck # tsc --noEmit
```

## License

MIT

# @astro-bay/content-hub

An Astro integration that aggregates entries from multiple content collections (Obsidian vaults, incoming RSS/Atom feeds, or any Astro content-loader source), normalizes them into a unified entry shape, applies a user-defined transform pipeline, builds emergent taxonomy pages, generates UID-based permalinks with Astro-native redirects, and exposes paginated hub and article pages at build time.


## Use Case

A personal knowledge site pulls content from two sources: an Obsidian vault of long-form articles and an external RSS feed of shorter commentary. Both collections define `topics` in their frontmatter. The site needs:

- A single `/articles/[uid]` page for every entry, regardless of source.
- Topic hub pages at `/topics/[topic]` that group entries across both collections, sorted by date.
- A browseable topic index at `/topics` showing every topic with entry counts.
- Alias redirects so old URLs like `/posts/my-old-slug` resolve to the current canonical permalink.
- Pagefind-compatible attributes so a search integration can offer faceted topic filtering and a smart-404 page can suggest the closest match for mistyped URLs.
- An outgoing RSS feed and WebSub notification so subscribers receive updates.

`@astro-bay/content-hub` handles all of this with a single integration call. The user defines their collections, optionally wires up transforms, and the plugin generates every route, redirect, and Pagefind attribute automatically.


## Install

```sh
pnpm install @astro-bay/content-hub
```


## Quick Start

```ts
// astro.config.ts
import { defineConfig } from 'astro/config'
import contentHub from '@astro-bay/content-hub'

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    contentHub({
      collections: ['vault', 'feed'],
      permalinks: { articleBase: 'articles' },
      taxonomy:   { route: 'topics' },
      browse:     { pageSize: 20 },
      locale:     { lang: 'en', dateLocale: 'en-US' },
    }),
  ],
})
```


## How It Works

On every build, the integration runs a six-step pipeline:

1. **Aggregate.** Collects all entries from the listed collections into a flat array.
2. **Normalize.** Converts each entry into a `NormalizedEntry` shape (uid, title, topics, date, etc.), mapping source-specific fields like RSS `<category>` elements into the common structure.
3. **Transform.** Runs the user-defined transform pipeline in config array order, then optionally expands topics with taxonomy ancestors if `astro-taxonomy` is installed.
4. **Filter and group.** Removes drafts, builds a topic map and topic groups, detects UID and alias collisions (fatal errors) and reports them before any routes are injected.
5. **Inject routes and redirects.** Injects article, topic hub, and topic index routes via `injectRoute`. Injects alias redirects into Astro's native `redirects` config so the adapter (Netlify, Vercel, Cloudflare, Node) generates platform-specific redirect rules.
6. **Emit search attributes.** Writes `data-pagefind-*` attributes on every article page so downstream search tools can index and filter content.

All of this happens exactly once per build via a module-level cache (`getHubData`), regardless of how many injected pages consume the data.


## Full Implementation Guide

### 1. Define Content Collections

Collections are defined in `src/content.config.ts` using Astro's `defineCollection` and the schemas exported by the plugin. Each collection pairs a loader (the data source) with a schema (the frontmatter shape).

#### Schema mapping

The plugin exports two base Zod schemas that map source-specific frontmatter into the fields the integration expects:

- `contentHubSchema` covers vault/Markdown content: `uid`, `title`, `topics`, `aliases`, `date`, `draft`, `excerpt`. If your Obsidian vault frontmatter already uses these field names, the schema handles it directly with no additional mapping.
- `feedEntrySchema` extends the base with `categories` (for RSS `<category>` elements) and `link` (the original source URL). During aggregation, if a feed entry's `topics` array is empty, the `categories` array is used as the topic source instead.

#### Extending with project-specific fields

Both schemas are standard Zod objects, so you extend them with `.extend()` to add fields the plugin doesn't own. Extended fields are available in `entry.data` within your Astro pages and templates. They do not affect the integration's behavior (it only reads the base fields), but they travel with the entry and are accessible in custom layouts.

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content'
import { contentHubSchema, feedEntrySchema } from '@astro-bay/content-hub/schema'
import { z } from 'astro:content'

// Obsidian vault (via astro-loader-obsidian)
import obsidianLoader from 'astro-loader-obsidian'

// Incoming RSS feed (via @ascorbic/feed-loader or similar)
import feedLoader from '@ascorbic/feed-loader'

const vault = defineCollection({
  loader: obsidianLoader({ vault: 'src/content/vault' }),
  // The schema callback receives Astro's image() helper for optimized images.
  // Extend contentHubSchema with any project-specific fields your layouts need.
  schema: ({ image }) =>
    contentHubSchema.extend({
      image: image().optional(),            // Optimized hero image via Astro's image pipeline
      featured: z.boolean().default(false), // Custom flag for homepage featured slots
    }),
})

const feed = defineCollection({
  loader: feedLoader({ url: 'https://yourfeed.example/rss' }),
  // feedEntrySchema adds categories and link on top of contentHubSchema.
  // Extend further if your feed includes custom fields.
  schema: feedEntrySchema,
})

export const collections = { vault, feed }
```

The collection names you use here (`vault`, `feed`) are the same strings you pass to the integration's `collections` option. The integration reads entries from each named collection at build time, validates them against whichever schema you assigned, and normalizes the result into `NormalizedEntry` objects for the rest of the pipeline.

If a content source uses different field names than the schema expects (for example, `tags` instead of `topics`), handle the remapping in the Zod schema itself using `.transform()`:

```ts
const vault = defineCollection({
  loader: obsidianLoader({ vault: 'src/content/vault' }),
  schema: z.object({
    title: z.string(),
    tags: z.array(z.string()).default([]),
    // ... other fields
  }).transform(data => ({
    ...data,
    topics: data.tags,  // Remap tags -> topics so the integration can find them
  })),
})
```


### 2. Configure the Integration

```ts
// astro.config.ts
import { defineConfig } from 'astro/config'
import contentHub from '@astro-bay/content-hub'
import { inferReadingTime, tagWithOpenCalais } from './src/transforms'

export default defineConfig({
  site: 'https://example.org',
  integrations: [
    contentHub({
      collections: ['vault', 'feed'],
      taxonomy: {
        field: 'topics',
        feedCategoryField: 'categories',
        route: 'topics',
        indexPage: true,
      },
      permalinks: {
        field: 'uid',
        aliasField: 'aliases',
        articleBase: 'articles',
      },
      browse: { pageSize: 20 },
      locale: { lang: 'en', dateLocale: 'en-US' },
      transforms: [
        tagWithOpenCalais({ apiKey: process.env.OPENCALAIS_KEY! }),
        inferReadingTime,
      ],
    }),
  ],
})
```

Every option except `collections` has a sensible default. A minimal config is just `contentHub({ collections: ['blog'] })`.


### 3. Wire Up astro-taxonomy (Optional)

When `astro-taxonomy` is installed as a peer dependency, a built-in transform automatically runs after all user transforms. It imports the resolved taxonomy graph and expands each entry's topics to include all ancestors.

An entry tagged only "Affordable Housing" will also carry "Housing" after expansion, so it appears on the Housing hub page and in Pagefind results filtered by "Housing."

No configuration is needed. If `astro-taxonomy` is not installed, topics remain flat.


### 4. Search and Smart 404s (astro-pagefind, astro-pagefind-resolve)

Every article page emits `data-pagefind-*` attributes as a stable contract for downstream search integrations:

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-pagefind-body` | `<article>` | Marks the indexable content region |
| `data-pagefind-weight="10"` | `<h1>` | Weights title heavily in search ranking |
| `data-pagefind-filter="topic[content]"` | `<meta>` per topic | Faceted topic filtering (uses display label) |
| `data-pagefind-filter="source[content]"` | `<meta>` | Faceted source filtering (vault, feed, etc.) |
| `data-pagefind-meta="date[content]"` | `<meta>` | ISO date exposed in search result display |
| `data-pagefind-meta="uid[content]"` | `<meta>` | UID exposed for smart 404 path matching |
| `data-pagefind-meta="excerpt[content]"` | `<meta>` | Excerpt for search result snippets |
| `data-pagefind-ignore` | Topic listing pages | Prevents listing pages from polluting search |

`astro-pagefind` indexes the built HTML and reads these attributes. `astro-pagefind-resolve` consumes the same Pagefind index (including the `uid` meta attribute) to power a smart 404 page that suggests the closest matching article when a user navigates to a broken or mistyped URL.

Topics added by transforms (semantic tags, entity names) are automatically included as additional `data-pagefind-filter="topic[content]"` values because transforms run before attribute emission. This gives you semantic faceting through flat Pagefind filters with no changes to the search setup.


### 5. Outgoing RSS Feed

The plugin does not own feed generation. Use `@astrojs/rss` with the exported `toFeedItems` helper, which filters out drafts and feed-origin entries (to prevent re-syndication), then maps the rest to `@astrojs/rss`-compatible items:

```ts
// src/pages/feed.xml.ts
import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { aggregateEntries, sortByDate, toFeedItems } from '@astro-bay/content-hub/utils'

export const GET = async (context) => {
  const all = await aggregateEntries(['vault', 'feed'], getCollection)
  const sorted = sortByDate(all)

  return rss({
    title: 'My Content Hub',
    description: 'Latest articles',
    site: context.site,
    items: toFeedItems(sorted, 'articles'),
  })
}
```

`toFeedItems` calls `toRssItem` internally. If you need more control (custom fields, different filtering), use `toRssItem` directly:

```ts
import { filterPublished, toRssItem } from '@astro-bay/content-hub/utils'

const items = filterPublished(sorted)
  .filter(e => e.source !== 'feed')
  .slice(0, 20)
  .map(e => toRssItem(e, 'articles'))
```


### 6. JSON-LD Structured Data

When `@astro-bay/jsonld` is installed as a peer dependency, the integration exposes JSON-LD providers for articles and topics. The `contentHub()` factory returns a `ContentHubIntegration` object with a `getJsonLdProviders()` method that returns provider objects compatible with `@astro-bay/jsonld`'s provider registration.

```ts
// astro.config.ts
import { defineConfig } from 'astro/config'
import contentHub from '@astro-bay/content-hub'
import jsonLd from '@astro-bay/jsonld'

const hub = contentHub({
  collections: ['vault', 'feed'],
})

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    hub,
    jsonLd({ providers: hub.getJsonLdProviders() }),
  ],
})
```

The article provider emits `BlogPosting` nodes with `headline`, `datePublished`, `about` (topic references), and `sameAs` (alias URLs). The topics provider emits `DefinedTerm` nodes with `skos:inScheme` linking back to the topic index. Both providers also emit `CollectionPage` nodes for their respective index pages.

Disable JSON-LD generation by setting `jsonld: { enabled: false }` in the integration options. Every injected page includes a `<link rel="alternate" type="application/ld+json">` pointing to its corresponding `.jsonld` file.


### 7. Browse Data for Client-Side Tables

Every article index and topic hub page embeds a `<script type="application/json" id="browse-data">` element containing a JSON array of `BrowseRow` objects. This enables client-side table rendering with TanStack Table or similar libraries without an additional data fetch.

#### BrowseTable component

The plugin ships a ready-made Astro component that hydrates the `#browse-data` embed with TanStack Table, providing sort, filter, and pagination out of the box.

```astro
---
import { BrowseTable } from '@astro-bay/content-hub/components'
---

<BrowseTable />
```

You can also import it from the direct entrypoint: `@astro-bay/content-hub/components/BrowseTable`.

#### Manual hydration

If you need full control over the table UI, you can still hydrate the embed yourself:

```ts
import { toBrowseData, createBrowseColumns } from '@astro-bay/content-hub/browse'
import type { BrowseRow } from '@astro-bay/content-hub/browse'
```

`BrowseRow` is a minimal projection of `NormalizedEntry` containing only `uid`, `title`, `date` (ISO string or null), `topics`, `excerpt`, and `source`. The `createBrowseColumns()` function returns TanStack Table column definitions with sensible defaults for sorting and filtering (date sorts nulls-last, topics filter by intersection).

Client-side hydration:

```ts
// In a client-side script
const el = document.getElementById('browse-data')
const rows: BrowseRow[] = JSON.parse(el?.textContent ?? '[]')
```


### 8. WebSub Notification

WebSub hub pinging is handled outside the integration, typically in a post-build script or CI step. After a successful build that generates `feed.xml`, ping the hub:

```sh
# post-build.sh (run in CI after astro build)
curl -X POST https://websub.example/hub \
  -d "hub.mode=publish" \
  -d "hub.url=https://example.org/feed.xml"
```

The feed itself advertises the hub via a `<link rel="hub">` element, which you add in your `feed.xml.ts` endpoint or as a header in your hosting config.


## UID and Permalinks

The `uid` field is the entry's permanent URL path segment. Every article's canonical URL is `/{articleBase}/{uid}`, for example `/articles/community-gardens`. Despite the name, `uid` is not a UUID or random identifier. It is a human-readable, author-chosen slug that serves as the entry's stable permalink.

- If frontmatter includes an explicit `uid`, that value is used as-is.
- If `uid` is omitted, the integration falls back to the collection entry's id (typically the filename without extension) and logs a warning recommending an explicit uid.
- The uid must be unique across all collections in a hub instance. If two entries share a uid, the build fails with a `UidCollision` error naming both entries and their source collections.

Because the uid is the permalink, changing it breaks existing links. The `aliases` field exists for this purpose.


## Aliases and Redirects

The `aliases` frontmatter field is an array of old URL slugs that should redirect to the entry's current uid. The integration collects every alias-to-uid mapping across all entries, then injects them into Astro's native `redirects` configuration during `astro:config:setup`:

```ts
// What the integration does internally:
updateConfig({
  redirects: {
    '/articles/old-slug': '/articles/current-uid',
    '/articles/another-old-slug': '/articles/current-uid',
  }
})
```

Astro handles everything from there. In SSG mode with no adapter, Astro generates HTML redirect pages. With a Netlify, Vercel, or Cloudflare adapter, the adapter writes platform-native redirect rules (e.g., `_redirects` for Netlify, `vercel.json` entries for Vercel). The integration never writes redirect files itself.

If two entries claim the same alias, the build fails with an `AliasCollision` error naming the alias and both claimants. All collisions are reported in a single error, not just the first.


## Frontmatter Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `uid` | `string` | no | entry id | Permanent permalink slug. See "UID and Permalinks" above. |
| `title` | `string` | yes | — | Article title |
| `topics` | `string[]` | no | `[]` | Taxonomy topics. For feed entries, RSS `<category>` elements fill this when empty. |
| `aliases` | `string[]` | no | `[]` | Old URL slugs. See "Aliases and Redirects" above. |
| `date` | `Date` | no | — | Publication date. Entries sort by date descending; undated entries sort last. |
| `draft` | `boolean` | no | `false` | Excluded from published output. Present in `raw` and `transformed` for debug use. |
| `excerpt` | `string` | no | — | Short description for cards, meta tags, and search result snippets |


## Injected Routes

| Pattern | Description |
|---------|-------------|
| `/articles` | Article index page (client-side browse) |
| `/articles/[uid]` | Individual article page |
| `/topics` | Topic index (cloud with counts) |
| `/topics/[topic]` | Topic hub page (client-side browse) |

All routes are prerendered at build time (`prerender: true`). Alias redirects are injected into Astro's native `redirects` config, not as injected routes. The adapter generates platform-specific redirect rules automatically.

Users override any injected route by creating a page at the same path. Astro gives user-defined pages priority.


## Multiple Hubs

Two or more hub instances can coexist on one site. Each operates on its own collections and injects routes under its own prefixes. Route prefixes must not collide; the integration validates this at `astro:config:setup` and throws a descriptive `RouteConflict` error before any routes are injected.

```ts
integrations: [
  contentHub({
    name: 'writing',
    collections: ['blog'],
    permalinks: { articleBase: 'writing' },
    taxonomy: { route: 'writing-topics' },
  }),
  contentHub({
    name: 'notes',
    collections: ['vault'],
    permalinks: { articleBase: 'notes' },
    taxonomy: { route: 'note-topics' },
  }),
]
```


## Custom Transforms

Transforms are pure-to-async functions that receive a `NormalizedEntry` and a `TransformContext`, and return a new entry. They run after aggregation but before taxonomy grouping, so new topics added by a transform appear on hub pages and in Pagefind filter attributes automatically.

```ts
import type { EntryTransform } from '@astro-bay/content-hub/types'

const addReadTime: EntryTransform = entry => ({
  ...entry,
  meta: { ...entry.meta, readTime: Math.ceil((entry.excerpt?.length ?? 0) / 200) },
})

contentHub({ collections: ['blog'], transforms: [addReadTime] })
```

### Transform Pipeline Behavior

- Transforms for a single entry run sequentially (each sees the output of the previous). Entries run in parallel across the set.
- A transform that throws is caught at the pipeline boundary. The build logs a warning and continues with the original, pre-transform entry. A downed API should not prevent the site from building.
- Users who want a transform failure to be fatal can re-throw from a wrapping transform.
- Transforms run before `filterPublished`, so a transform can set `draft: true` to suppress an entry based on external rules.

### Hypothetical Transform Examples

Transforms are the plugin's extensibility mechanism. Any per-entry enrichment that returns a new `NormalizedEntry` fits the pattern:

- **Semantic tagging via NLP API.** Send each entry's excerpt to an entity extraction service (OpenCalais, spaCy, etc.). Merge extracted entities into `entry.topics`. Those entities then become topic hub pages and Pagefind filter values automatically.
- **Reading time estimation.** Count words in the excerpt or rendered body, compute minutes, store in `entry.meta.readingTime`. Display in article cards or page headers.
- **External link validation.** Check `entry.sourceLink` for feed entries. If the upstream URL returns a 404/410, set `draft: true` to suppress the entry from published output.
- **Sentiment analysis.** Score the entry's excerpt, store the sentiment label in `entry.meta.sentiment`. Use it in custom article page layouts to show a mood indicator.
- **Auto-excerpt generation.** For vault entries missing an excerpt, use the first N characters of the rendered body to populate `entry.excerpt`.
- **Cross-referencing.** Use `ctx.allEntries` to find entries that share topics with the current entry. Store related UIDs in `entry.meta.related` for a "Related Articles" component.
- **Content gating.** Check `entry.meta` or an external API for access-control rules. Set `draft: true` on entries that should not be public in the current build environment.

The `TransformContext` provides `ctx.cache` (a mutable `Map` scoped to the current build) so transforms that call external APIs can batch or deduplicate requests across entries.


## Draft Behaviour

- `draft: true` entries are always excluded from `published`.
- `raw` and `transformed` include all entries including drafts for debug use.


## Peer Integrations

| Integration | Relationship |
|-------------|-------------|
| `astro-taxonomy` | Optional peer. Content hub consumes its virtual module for ancestor expansion. Falls back to flat topics when absent. |
| `astro-loader-obsidian` | Optional peer. Provides the Obsidian vault content loader. |
| `@ascorbic/feed-loader` | Optional peer. Provides the RSS/Atom feed content loader. |
| `@astro-bay/jsonld` | Optional peer. Receives JSON-LD providers from `getJsonLdProviders()` for structured data generation. |
| `astro-pagefind` | External. Indexes built HTML, reads `data-pagefind-*` attributes emitted by content hub. |
| `astro-pagefind-resolve` | External. Consumes Pagefind's index (including uid/topic attributes) for smart 404 resolution. |
| `@astrojs/rss` | External. Generates outgoing RSS/Atom/JSON feeds using the exported utility functions. |
| `@astrojs/sitemap` | External. Discovers injected routes automatically. |


## Exported Utilities

Public helper functions for custom pages, feed generation, and sitemap logic:

```ts
import {
  aggregateEntries,    // (collections, getCollection) => Promise<NormalizedEntry[]>
  filterPublished,     // (entries) => NormalizedEntry[]
  sortByDate,          // (entries) => NormalizedEntry[]
  buildTopicMap,       // (entries) => Map<slug, label>
  groupByTopic,        // (entries) => Map<slug, NormalizedEntry[]>
  topicsWithCounts,    // (topicMap, grouped) => TopicWithCount[]
  entriesForTopic,     // (slug, grouped) => NormalizedEntry[]
  slugifyTopic,        // (raw) => string
  paginate,            // (entries, page, pageSize) => PageSlice
  detectCollisions,    // (entries) => Result<Map, ContentHubError>
  collectAliasRoutes,  // (entries) => Result<AliasRoute[], ContentHubError>
  runTransforms,       // (entries, transforms, ctx) => Promise<NormalizedEntry[]>
  toRssItem,           // (entry, articleBase) => RssItem
  toFeedItems,         // (entries, articleBase) => RssItem[] (filters drafts + feed-origin)
} from '@astro-bay/content-hub/utils'

import {
  toBrowseRow,         // (entry) => BrowseRow
  toBrowseData,        // (entries) => BrowseRow[]
  createBrowseColumns, // () => ColumnDef<BrowseRow>[]
} from '@astro-bay/content-hub/browse'

import {
  createContentHubProvider, // (opts) => JsonLdProvider (articles)
  createTopicsProvider,     // (opts) => JsonLdProvider (topics)
} from '@astro-bay/content-hub/jsonld'
```


## Error Handling

| Error | Severity | Behavior |
|-------|----------|----------|
| UID collision | Fatal | Build fails. Message names both entries and their source collections. |
| Alias collision | Fatal | Build fails. Message names the alias and both claimants. |
| Route conflict (multi-hub) | Fatal | Build fails at `astro:config:setup` before any routes are injected. |
| Missing `site` config | Warning | Logged once. Canonical URLs will be relative. |
| Missing uid (fallback to entry.id) | Warning | Logged per entry. Advises adding explicit uid. |
| Transform error | Warning | Logged per entry. Original entry used; build continues. |
| Empty collection | Info | Logged. No pages generated for that collection. |
| Entry with no topics | Silent | Entry has an article page but is excluded from topic hubs. |


## Code Organization

The codebase follows a functional core / imperative shell architecture. Domain modules (`aggregate`, `taxonomy`, `permalinks`, `paginate`, `config`, `transform/pipeline`, `browse`, `jsonld-provider`) contain zero I/O and zero Astro imports. They are pure functions that take data in and return data out. `hub-data.ts` and `integration.ts` form the imperative shell: they call Astro APIs, manage the build cache, and wire the domain functions together.

```
src/
├── types.ts              Pure domain types (NormalizedEntry, HubData, ContentHubError, etc.)
├── schema.ts             Zod schemas (contentHubSchema, feedEntrySchema)
├── config.ts             Option parsing, validation, ResolvedConfig (with in-file unit tests)
├── aggregate.ts          Collection reading, normalization, multi-collection combine
├── taxonomy.ts           slugifyTopic, buildTopicMap, groupByTopic, topicsWithCounts
├── paginate.ts           Pure pagination utility
├── permalinks.ts         UID and alias collision detection (Result-based)
├── browse.ts             BrowseRow projection and TanStack Table column definitions
├── jsonld-provider.ts    JSON-LD provider factories for articles and topics
├── registry.ts           Cross-hub route prefix uniqueness enforcement
├── hub-data.ts           Central getHubData() with module-level build cache (imperative shell)
├── integration.ts        AstroIntegration factory: hooks, injectRoute, updateConfig (imperative shell)
├── utils.ts              Public re-exports for custom pages
├── transform/
│   ├── pipeline.ts       safeTransform, runTransforms (pure orchestration)
│   └── ancestors.ts      Optional astro-taxonomy ancestor expansion
├── virtual/
│   └── module.ts         Vite virtual module plugin (@astro-bay/content-hub:config)
└── pages/
    ├── Article.astro     Injected article page with Pagefind attributes
    ├── ArticleIndex.astro     Injected article index page (client-side browse)
    ├── TopicHub.astro    Injected topic hub page (client-side browse)
    └── TopicIndex.astro  Injected topic cloud index
test/
├── builders.ts           NormalizedEntry test builder
├── arbitraries.ts        fast-check arbitraries for property tests
├── helpers.ts            expectOk / expectErr helpers for Result assertions
├── setup.ts              fast-check global config
└── hub-data.spec.ts      Layer 3 integration tests
```

### Testing approach

Tests are co-located with source using Vitest's `import.meta.vitest` for unit and property tests. Property tests (fast-check) verify invariants like slugification idempotency and pagination boundary correctness. They run behind `test.skipIf(tdd)` so the TDD loop stays fast. Integration tests in `test/hub-data.spec.ts` verify the full aggregation-through-grouping pipeline.


## API Stability

| Surface | Stability |
|---------|-----------|
| Integration options shape | Stable (semver major for breaking changes) |
| `contentHubSchema`, `feedEntrySchema` | Stable |
| `NormalizedEntry` type | Stable |
| `Transform`, `TransformContext` types | Stable |
| `PageSlice` type | Stable |
| Exported utilities (`/utils`, `/browse`, `/jsonld`) | Stable |
| Pagefind data attributes | Stable (contract with search/resolve plugins) |
| Browse data embed (`#browse-data`) | Stable |
| JSON-LD provider shape | Stable |
| Virtual module shape | Internal |
| Injected route paths | Stable (user-configurable) |


## Roadmap

Features under consideration for future releases:

- **SSR support.** Currently all injected routes are prerendered at build time. A future version will support Astro's `output: 'server'` and `output: 'hybrid'` modes, where article and topic pages render on request using `Astro.params` validation and the exported `paginate()` utility for request-time slicing. This includes cache strategy guidance and 404 handling for unknown UIDs, unknown topic slugs, and out-of-range page numbers.
- **Configurable search attribute markup.** The current Pagefind `data-pagefind-*` attributes are hardcoded. A future version will support a configurable attribute renderer so the integration can emit markup compatible with other search tools (Algolia, Meilisearch, Lunr, etc.) or disable search attributes entirely.


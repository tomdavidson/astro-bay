# @astro-bay/jsonld

An Astro integration that emits Solid-compatible Linked Data alongside HTML pages. For every route
registered with a provider, a sibling `.jsonld` file is generated containing structured data using
schema.org and SKOS vocabularies. The integration follows Solid project conventions (Type Index, LDP
containers, LDES change feeds) without requiring authentication or write-access.

## Installation

```sh
npm install @astro-bay/jsonld neverthrow ts-pattern
```

## Quick Start

```ts
// astro.config.ts
import { jsonLd } from '@astro-bay/jsonld'
import type { RouteJsonLd } from '@astro-bay/jsonld/types'
import { defineConfig } from 'astro/config'

const myProvider = {
  name: 'my-articles',
  provide: async (): Promise<
    ReadonlyArray<RouteJsonLd>
  > => [{
    route: '/articles/hello/',
    node: {
      '@type': 'BlogPosting',
      '@id': 'https://example.com/articles/hello/',
      'headline': 'Hello World',
      'datePublished': '2026-01-01T00:00:00Z',
    },
  }],
}

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    jsonLd({
      providers: [myProvider],
      typeRegistrations: [{
        rdfType: 'https://schema.org/BlogPosting',
        containerPath: '/articles/',
        label: 'Articles',
      }],
    }),
  ],
})
```

After `astro build`, each registered route produces a sibling `.jsonld` file:

```
dist/
  articles/
    hello/
      index.html
      index.jsonld    ← generated
    index.jsonld      ← generated (if collection route registered)
  index.jsonld        ← Solid Type Index (if typeRegistrations provided)
  changes.jsonld      ← LDES change feed (if ldes.enabled, default true)
```

## Configuration

```ts
import type { JsonLdOptions } from '@astro-bay/jsonld/config'
```

| Option              | Type                     | Default                                 | Description                                             |
| ------------------- | ------------------------ | --------------------------------------- | ------------------------------------------------------- |
| `site`              | `string`                 | `config.site`                           | Base URL for absolute `@id` generation                  |
| `context`           | `Record<string, string>` | schema.org + SKOS + LDP + LDES defaults | JSON-LD `@context` entries                              |
| `providers`         | `JsonLdProvider[]`       | `[]`                                    | Route → JSON-LD node mappings                           |
| `typeRegistrations` | `TypeRegistration[]`     | `[]`                                    | Solid Type Index entries                                |
| `ldes.enabled`      | `boolean`                | `true`                                  | Emit LDES change feed                                   |
| `ldes.path`         | `string`                 | `'/changes.jsonld'`                     | Output path for change feed                             |
| `ldes.stateFile`    | `string`                 | `'.@astro-bay/jsonld-state.json'`       | Persisted hash state between builds                     |
| `validate`          | `boolean`                | `true`                                  | Fail build on missing `@id`/`@type` or duplicate routes |

## Provider Contract

A provider is any object implementing:

```ts
type JsonLdProvider = {
  readonly name: string
  readonly provide: () => Promise<ReadonlyArray<RouteJsonLd>>
}
```

`provide()` is called once during `astro:build:done`. It returns route–node pairs. The `route` field
must match the Astro route path exactly (e.g., `/articles/hello/`).

### Example: Blog Articles Provider

```ts
import type { JsonLdProvider, RouteJsonLd } from '@astro-bay/jsonld/types'

export const createArticlesProvider = (
  site: string,
  articles: ReadonlyArray<{ slug: string; title: string; date: Date }>,
): JsonLdProvider => ({
  name: 'articles',
  provide: async (): Promise<ReadonlyArray<RouteJsonLd>> =>
    articles.map(a => ({
      route: `/articles/${a.slug}/`,
      node: {
        '@type': 'BlogPosting',
        '@id': `${site}/articles/${a.slug}/`,
        'headline': a.title,
        'datePublished': a.date.toISOString(),
      },
    })),
})
```

### Example: Taxonomy Terms Provider

```ts
import type { JsonLdProvider, RouteJsonLd } from '@astro-bay/jsonld/types'

export const createTopicsProvider = (
  site: string,
  topics: ReadonlyArray<{ slug: string; label: string }>,
): JsonLdProvider => ({
  name: 'topics',
  provide: async (): Promise<ReadonlyArray<RouteJsonLd>> =>
    topics.map(t => ({
      route: `/topics/${t.slug}/`,
      node: {
        '@type': 'DefinedTerm',
        '@id': `${site}/topics/${t.slug}/`,
        'name': t.label,
        'skos:inScheme': { '@id': `${site}/topics/` },
      },
    })),
})
```

### Example: Generic Collection Provider

```ts
import type { JsonLdProvider, RouteJsonLd } from '@astro-bay/jsonld/types'

export const createCollectionProvider = (
  site: string,
  basePath: string,
  items: ReadonlyArray<{ slug: string; title: string }>,
): JsonLdProvider => ({
  name: `collection-${basePath}`,
  provide: async (): Promise<ReadonlyArray<RouteJsonLd>> => {
    const itemNodes = items.map(item => ({
      '@type': 'Thing',
      '@id': `${site}${basePath}${item.slug}/`,
      'name': item.title,
    }))

    const collectionRoute: RouteJsonLd = {
      route: basePath,
      node: {
        '@type': 'CollectionPage',
        '@id': `${site}${basePath}`,
        'name': basePath.replace(/\//g, '').charAt(0).toUpperCase() +
          basePath.replace(/\//g, '').slice(1),
        'numberOfItems': items.length,
      },
      members: itemNodes,
    }

    const itemRoutes: ReadonlyArray<RouteJsonLd> = items.map((item, i) => ({
      route: `${basePath}${item.slug}/`,
      node: itemNodes[i]!,
    }))

    return [collectionRoute, ...itemRoutes]
  },
})
```

## Type Index (Solid Pattern)

When `typeRegistrations` are provided, the integration writes a `/index.jsonld` file containing a
Solid Type Index. This allows Solid-compatible clients (Comunica, LDkit) to discover containers for
each RDF type:

```json
{
  "@context": { "solid": "http://www.w3.org/ns/solid/terms#", ... },
  "@type": "WebSite",
  "@id": "https://example.com/",
  "hasPart": [
    {
      "@type": "solid:TypeRegistration",
      "solid:forClass": "https://schema.org/BlogPosting",
      "solid:instanceContainer": "https://example.com/articles/",
      "name": "Articles"
    }
  ]
}
```

## LDES Change Feed

On each build, the integration diffs the current set of JSON-LD nodes against a persisted state file
(`.@astro-bay/jsonld-state.json`). If any routes were added, updated, or removed, it writes
`/changes.jsonld` describing the changes as an LDES EventStream:

```json
{
  "@context": { "as": "https://www.w3.org/ns/activitystreams#", ... },
  "@type": "ldes:EventStream",
  "@id": "https://example.com/changes.jsonld",
  "tree:member": [
    {
      "@type": "as:Create",
      "as:object": { "@id": "https://example.com/articles/new-post/" },
      "as:published": "2026-04-05T00:00:00.000Z"
    }
  ]
}
```

External aggregators can poll `/changes.jsonld` instead of re-crawling the entire site. If the state
file is missing or corrupt, the integration treats the build as a first build (all routes become
`as:Create`) and logs a warning.

## Content Negotiation

The integration does not implement CDN-level content negotiation. Each hosting platform handles it
differently.

### Netlify (`netlify.toml`)

```toml
[[headers]]
for = "/*.jsonld"
[headers.values]
Content-Type = "application/ld+json; charset=utf-8"
Access-Control-Allow-Origin = "*"

[[redirects]]
from = "/articles/*"
to = "/articles/:splat/index.jsonld"
status = 200
conditions = { Accept = ["application/ld+json"] }
```

### Cloudflare Workers

```ts
if (request.headers.get('Accept')?.includes('application/ld+json')) {
  const jsonldUrl = new URL(url.pathname + '/index.jsonld', url.origin)
  return fetch(jsonldUrl)
}
```

### Astro SSR / Hybrid

In SSR or hybrid mode, register the negotiation middleware from this package:

```ts
// src/middleware.ts
import { createNegotiationMiddleware } from '@astro-bay/jsonld'
import { sequence } from 'astro:middleware'

const knownRoutes = new Set(['/articles/', '/articles/hello/'])

export const onRequest = sequence(createNegotiationMiddleware(knownRoutes))
```

## Runtime Modes

| Mode       | JSON-LD source                                         | Head injection                                   | Content negotiation                           |
| ---------- | ------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------- |
| **SSG**    | Static `.jsonld` files at build time                   | Manual `<link rel="alternate">` in page `<head>` | CDN rules (see above)                         |
| **Hybrid** | Static files for prerendered; middleware for on-demand | Same                                             | Middleware for on-demand; CDN for prerendered |
| **SSR**    | Middleware at request time                             | Middleware injection                             | `createNegotiationMiddleware`                 |

Zero client-side JavaScript is emitted in any mode.

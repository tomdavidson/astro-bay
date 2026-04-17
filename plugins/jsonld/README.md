# @astro-bay/jsonld

Emit Solid-compatible Linked Data alongside Astro pages. For every route registered
with a provider, a sibling `.jsonld` file is generated containing structured data
using schema.org and SKOS vocabularies.

Follows [Solid](https://solidproject.org/) project conventions (Type Index, LDP containers, LDES change feeds)
without requiring authentication or write-access.

## What gets a `.jsonld` file

JSON-LD endpoints represent **containers and resources**, not API query responses.

| Route kind             | Example                    | Gets `.jsonld`? |
| ---------------------- | -------------------------- | --------------- |
| Canonical resource     | `/articles/my-post/`       | Yes             |
| Container (collection) | `/articles/`               | Yes             |
| Taxonomy term          | `/topics/typescript/`      | Yes             |
| UI query / filter view | `/articles/topic1+topic2/` | No              |
| Paginated view         | `/articles/page/2/`        | No              |

A filtered page like `/articles/topic1+topic2/index.html` can absolutely be
prerendered by Astro (via `getStaticPaths`), but it is a **view over existing
containers**, not a container itself. The data it displays is already available
by fetching `/topics/topic1/index.jsonld` and `/topics/topic2/index.jsonld` and
intersecting their members.

This means a client may `GET /articles/topic1+topic2/index.html` (200) but
`GET /articles/topic1+topic2/index.jsonld` (404). That is intentional. In a
CQRS model, the `.html` is a read-model projection for human convenience. In
Linked Data, `.jsonld` exists only for stable, addressable things: a resource,
a container, a term.

**Rule of thumb:** if the URL identifies a _thing_ (an article, a topic, a
collection), it gets a `.jsonld` sibling. If it identifies a _query_ (a filter,
a sort, a page offset), it does not.

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

After `astro build`:

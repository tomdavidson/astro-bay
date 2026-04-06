import type { JsonLdProvider, RouteJsonLd, JsonLdNode } from '@astro-bay/jsonld/types'
import type { NormalizedEntry } from './types.ts'
import { slugifyTopic } from './taxonomy.ts'

type ArticleProviderConfig = {
  readonly site: string
  readonly articleBase: string
  readonly taxonomyRoute: string
  readonly entries: ReadonlyArray<NormalizedEntry>
}

type TopicsProviderConfig = {
  readonly site: string
  readonly taxonomyRoute: string
  readonly topicMap: ReadonlyMap<string, string>
  readonly groupedEntries: ReadonlyMap<string, ReadonlyArray<NormalizedEntry>>
}

const stripTrailingSlash = (s: string): string =>
  s.endsWith('/') ? s.slice(0, -1) : s

const entryToNode = (config: {
  readonly entry: NormalizedEntry
  readonly site: string
  readonly articleBase: string
  readonly taxonomyRoute: string
}): JsonLdNode => {
  const { entry, site, articleBase, taxonomyRoute } = config
  const id = `${stripTrailingSlash(site)}/${articleBase}/${entry.uid}/`

  const node: Record<string, unknown> = {
    '@type': 'BlogPosting',
    '@id': id,
    headline: entry.title,
    keywords: entry.topics,
  }

  if (entry.date !== undefined) {
    node.datePublished = entry.date.toISOString()
  }

  if (entry.excerpt !== undefined) {
    node.description = entry.excerpt
  }

  if (entry.topics.length > 0) {
    node.about = entry.topics.map(t => ({
      '@id': `${stripTrailingSlash(site)}/${taxonomyRoute}/${slugifyTopic(t)}/`,
    }))
  }

  if (entry.aliases.length > 0) {
    node.sameAs = entry.aliases.map(
      a => `${stripTrailingSlash(site)}/${articleBase}/${a}/`,
    )
  }

  return node as unknown as JsonLdNode
}

const entryToSummaryNode = (
  entry: NormalizedEntry,
  site: string,
  articleBase: string,
): JsonLdNode => ({
  '@type': 'BlogPosting',
  '@id': `${stripTrailingSlash(site)}/${articleBase}/${entry.uid}/`,
  headline: entry.title,
})

export const createContentHubProvider = (
  config: ArticleProviderConfig,
): JsonLdProvider => ({
  name: 'content-hub-articles',
  provide: async (): Promise<ReadonlyArray<RouteJsonLd>> => {
    const { site, articleBase, taxonomyRoute, entries } = config
    const base = stripTrailingSlash(site)

    const articleRoutes: ReadonlyArray<RouteJsonLd> = entries.map(entry => ({
      route: `/${articleBase}/${entry.uid}/`,
      node: entryToNode({ entry, site, articleBase, taxonomyRoute }),
    }))

    const collectionRoute: RouteJsonLd = {
      route: `/${articleBase}/`,
      node: {
        '@type': 'CollectionPage',
        '@id': `${base}/${articleBase}/`,
        name: 'Articles',
        numberOfItems: entries.length,
      },
      members: entries.map(e => entryToSummaryNode(e, site, articleBase)),
    }

    return [...articleRoutes, collectionRoute]
  },
})

export const createTopicsProvider = (
  config: TopicsProviderConfig,
): JsonLdProvider => ({
  name: 'content-hub-topics',
  provide: async (): Promise<ReadonlyArray<RouteJsonLd>> => {
    const { site, taxonomyRoute, topicMap, groupedEntries } = config
    const base = stripTrailingSlash(site)

    const topicRoutes: ReadonlyArray<RouteJsonLd> = [...topicMap.entries()].map(
      ([slug, label]) => ({
        route: `/${taxonomyRoute}/${slug}/`,
        node: {
          '@type': 'DefinedTerm',
          '@id': `${base}/${taxonomyRoute}/${slug}/`,
          name: label,
          'skos:inScheme': { '@id': `${base}/${taxonomyRoute}/` },
          ...(groupedEntries.get(slug) !== undefined
            ? { numberOfItems: groupedEntries.get(slug)!.length }
            : {}),
        } as unknown as JsonLdNode,
      }),
    )

    const collectionRoute: RouteJsonLd = {
      route: `/${taxonomyRoute}/`,
      node: {
        '@type': 'CollectionPage',
        '@id': `${base}/${taxonomyRoute}/`,
        name: 'Topics',
        numberOfItems: topicMap.size,
      },
    }

    return [...topicRoutes, collectionRoute]
  },
})

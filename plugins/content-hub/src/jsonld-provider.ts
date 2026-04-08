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

const buildAbout = (entry: NormalizedEntry, site: string, taxonomyRoute: string): Record<string, unknown> =>
  entry.topics.length === 0
    ? {}
    : { about: entry.topics.map(t => ({ '@id': `${stripTrailingSlash(site)}/${taxonomyRoute}/${slugifyTopic(t)}/` })) }

const buildSameAs = (entry: NormalizedEntry, site: string, articleBase: string): Record<string, unknown> =>
  entry.aliases.length === 0
    ? {}
    : { sameAs: entry.aliases.map(a => `${stripTrailingSlash(site)}/${articleBase}/${a}/`) }

const entryToNode = (config: {
  readonly entry: NormalizedEntry
  readonly site: string
  readonly articleBase: string
  readonly taxonomyRoute: string
}): JsonLdNode => {
  const { entry, site, articleBase, taxonomyRoute } = config
  const id = `${stripTrailingSlash(site)}/${articleBase}/${entry.uid}/`

  return {
    '@type': 'BlogPosting',
    '@id': id,
    headline: entry.title,
    keywords: entry.topics,
    ...(entry.date === undefined ? {} : { datePublished: entry.date.toISOString() }),
    ...(entry.excerpt === undefined ? {} : { description: entry.excerpt }),
    ...buildAbout(entry, site, taxonomyRoute),
    ...buildSameAs(entry, site, articleBase),
  } satisfies JsonLdNode
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

type TopicNodeInput = {
  readonly slug: string
  readonly label: string
  readonly base: string
  readonly taxonomyRoute: string
  readonly groupedEntries: ReadonlyMap<string, ReadonlyArray<NormalizedEntry>>
}

const topicToNode = (input: TopicNodeInput): JsonLdNode => {
  const { slug, label, base, taxonomyRoute, groupedEntries } = input
  const groupSize = groupedEntries.get(slug)?.length
  return {
    '@type': 'DefinedTerm',
    '@id': `${base}/${taxonomyRoute}/${slug}/`,
    name: label,
    'skos:inScheme': { '@id': `${base}/${taxonomyRoute}/` },
    ...(groupSize === undefined ? {} : { numberOfItems: groupSize }),
  } satisfies JsonLdNode
}

const buildTopicRoutes = (
  config: TopicsProviderConfig,
): ReadonlyArray<RouteJsonLd> => {
  const { site, taxonomyRoute, topicMap, groupedEntries } = config
  const base = stripTrailingSlash(site)
  return [...topicMap.entries()].map(([slug, label]) => ({
    route: `/${taxonomyRoute}/${slug}/`,
    node: topicToNode({ slug, label, base, taxonomyRoute, groupedEntries }),
  }))
}

export const createTopicsProvider = (
  config: TopicsProviderConfig,
): JsonLdProvider => ({
  name: 'content-hub-topics',
  provide: async (): Promise<ReadonlyArray<RouteJsonLd>> => {
    const base = stripTrailingSlash(config.site)
    const collectionRoute: RouteJsonLd = {
      route: `/${config.taxonomyRoute}/`,
      node: {
        '@type': 'CollectionPage',
        '@id': `${base}/${config.taxonomyRoute}/`,
        name: 'Topics',
        numberOfItems: config.topicMap.size,
      },
    }
    return [...buildTopicRoutes(config), collectionRoute]
  },
})

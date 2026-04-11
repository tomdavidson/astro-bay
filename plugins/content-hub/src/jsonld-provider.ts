import type { JsonLdNode, JsonLdProvider, RouteJsonLd } from '@astro-bay/jsonld/types'
import { slugifyTopic } from './taxonomy.ts'
import type { TopicHierarchyNode } from './taxonomy.ts'
import type { NormalizedEntry } from './types.ts'

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
  readonly hierarchy?: ReadonlyArray<TopicHierarchyNode>
}

const stripTrailingSlash = (s: string): string => s.endsWith('/') ? s.slice(0, -1) : s

const buildAbout = (entry: NormalizedEntry, site: string, taxonomyRoute: string): Record<string, unknown> =>
  entry.topics.length === 0 ?
    {} :
    {
      about: entry.topics.map(t => ({
        '@id': `${stripTrailingSlash(site)}/${taxonomyRoute}/${slugifyTopic(t)}/`,
      })),
    }

const buildSameAs = (entry: NormalizedEntry, site: string, articleBase: string): Record<string, unknown> =>
  entry.aliases.length === 0 ?
    {} :
    { sameAs: entry.aliases.map(a => `${stripTrailingSlash(site)}/${articleBase}/${a}/`) }

const buildIsPartOf = (site: string, articleBase: string): Record<string, unknown> => ({
  isPartOf: { '@id': `${stripTrailingSlash(site)}/${articleBase}/` },
})

const buildSourceLink = (entry: NormalizedEntry): Record<string, unknown> =>
  entry.source === 'feed' && entry.link !== undefined ? { sourceLink: entry.link } : {}

const entryToNode = (
  config: {
    readonly entry: NormalizedEntry
    readonly site: string
    readonly articleBase: string
    readonly taxonomyRoute: string
  },
): JsonLdNode => {
  const { entry, site, articleBase, taxonomyRoute } = config
  const base = stripTrailingSlash(site)
  const id = `${base}/${articleBase}/${entry.uid}/`

  const node: JsonLdNode & { readonly sourceLink?: string } = {
    '@type': 'BlogPosting',
    '@id': id,
    headline: entry.title,
    keywords: entry.topics,
    ...(entry.date === undefined ? {} : { datePublished: entry.date.toISOString() }),
    ...(entry.excerpt === undefined ? {} : { description: entry.excerpt }),
    ...buildIsPartOf(site, articleBase),
    ...buildAbout(entry, site, taxonomyRoute),
    ...buildSameAs(entry, site, articleBase),
    ...buildSourceLink(entry),
  }

  return node
}

const entryToSummaryNode = (entry: NormalizedEntry, site: string, articleBase: string): JsonLdNode => ({
  '@type': 'BlogPosting',
  '@id': `${stripTrailingSlash(site)}/${articleBase}/${entry.uid}/`,
  headline: entry.title,
})

export const createContentHubProvider = (config: ArticleProviderConfig): JsonLdProvider => ({
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
  readonly hierarchyBySlug?: ReadonlyMap<string, TopicHierarchyNode> | undefined
}

type TopicHierarchyContext = {
  readonly slug: string
  readonly base: string
  readonly taxonomyRoute: string
  readonly hierarchyBySlug?: ReadonlyMap<string, TopicHierarchyNode> | undefined
}

type BroaderNarrower = {
  readonly broader?: ReadonlyArray<{ readonly '@id': string }> | undefined
  readonly narrower?: ReadonlyArray<{ readonly '@id': string }> | undefined
}

const resolveBroaderNarrower = (ctx: TopicHierarchyContext): BroaderNarrower => {
  const { slug, base, taxonomyRoute, hierarchyBySlug } = ctx
  if (hierarchyBySlug === undefined) return {}

  const node = hierarchyBySlug.get(slug)
  if (node === undefined) return {}

  const broader = node.parent === undefined ?
    undefined :
    [{ '@id': `${base}/${taxonomyRoute}/${node.parent}/` }]

  const narrower = node.children.length === 0 ?
    undefined :
    node.children.map(childSlug => ({ '@id': `${base}/${taxonomyRoute}/${childSlug}/` }))

  return { broader, narrower }
}

const topicToNode = (input: TopicNodeInput): JsonLdNode => {
  const { slug, label, base, taxonomyRoute, groupedEntries, hierarchyBySlug } = input
  const groupSize = groupedEntries.get(slug)?.length
  const nodeId = `${base}/${taxonomyRoute}/${slug}/`

  const { broader, narrower } = resolveBroaderNarrower({ slug, base, taxonomyRoute, hierarchyBySlug })

  return {
    '@type': 'DefinedTerm',
    '@id': nodeId,
    name: label,
    'skos:inScheme': { '@id': `${base}/${taxonomyRoute}/` },
    ...(groupSize === undefined ? {} : { numberOfItems: groupSize }),
    ...(broader === undefined ? {} : { 'skos:broader': broader }),
    ...(narrower === undefined ? {} : { 'skos:narrower': narrower }),
  } satisfies JsonLdNode
}

const buildTopicRoutes = (config: TopicsProviderConfig): ReadonlyArray<RouteJsonLd> => {
  const { site, taxonomyRoute, topicMap, groupedEntries, hierarchy } = config
  const base = stripTrailingSlash(site)

  const hierarchyBySlug = hierarchy === undefined ?
    undefined :
    new Map(hierarchy.map(node => [node.slug, node] as const))

  return [...topicMap.entries()].map(([slug, label]) => ({
    route: `/${taxonomyRoute}/${slug}/`,
    node: topicToNode({ slug, label, base, taxonomyRoute, groupedEntries, hierarchyBySlug }),
  }))
}

export const createTopicsProvider = (config: TopicsProviderConfig): JsonLdProvider => ({
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

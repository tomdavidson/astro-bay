import { filterPublished, sortByDate } from '../aggregate.ts'
import { getChildTopics, getRelatedTopics, getSiblingTopics } from '../taxonomy.ts'
import type { HubData, NormalizedEntry } from '../types.ts'

type TaxonomyGraph = {
  readonly ancestors: (slug: string) => ReadonlyArray<{ readonly slug: string; readonly label: string }>
  readonly children?: (slug: string) => ReadonlyArray<{ readonly slug: string; readonly label: string }>
  readonly edges: ReadonlyArray<unknown>
}

export type ArticleIndexRoute = {
  readonly params: Record<string, never>
  readonly props: {
    readonly entries: ReadonlyArray<NormalizedEntry>
    readonly fallbackEntries: ReadonlyArray<NormalizedEntry>
  }
}

export const buildArticleIndexRoutes = (
  data: HubData,
  fallbackCount: number,
): ReadonlyArray<ArticleIndexRoute> => {
  const published = sortByDate(filterPublished([...data.uidMap.values()]))
  return [{ params: {}, props: { entries: published, fallbackEntries: published.slice(0, fallbackCount) } }]
}

export type TopicHubRoute = {
  readonly params: { readonly topic: string }
  readonly props: {
    readonly slug: string
    readonly label: string
    readonly related: ReadonlyArray<{ readonly slug: string; readonly label: string; readonly count: number }>
    readonly children: ReadonlyArray<{ readonly slug: string; readonly label: string }>
    readonly siblings: ReadonlyArray<{ readonly slug: string; readonly label: string }>
    readonly ancestorChain: ReadonlyArray<{ readonly slug: string; readonly label: string }>
    readonly entries: ReadonlyArray<NormalizedEntry>
    readonly fallbackEntries: ReadonlyArray<NormalizedEntry>
  }
}

export type BuildTopicRouteContext = {
  readonly slug: string
  readonly entries: ReadonlyArray<NormalizedEntry>
  readonly data: HubData
  readonly graph: TaxonomyGraph | undefined
  readonly fallbackCount: number
}

export const buildTopicRoute = (ctx: BuildTopicRouteContext): ReadonlyArray<TopicHubRoute> => {
  const { slug, entries, data, graph, fallbackCount } = ctx
  const label = data.topicMap.get(slug) ?? slug
  const relatedArgs = { slug, entries: data.published, ...(graph !== undefined && { graph }) } as const
  const related = getRelatedTopics(relatedArgs)
  const children = getChildTopics(slug, graph, data.topicMap)
  const siblings = getSiblingTopics(slug, graph, data.topicMap)
  const ancestorChain = graph ? graph.ancestors(slug) : []

  return [{
    params: { topic: slug },
    props: {
      slug,
      label,
      related,
      children,
      siblings,
      ancestorChain,
      entries: [...entries],
      fallbackEntries: [...entries].slice(0, fallbackCount),
    },
  }]
}

export const buildTopicHubRoutes = (
  data: HubData,
  graph: TaxonomyGraph | undefined,
  fallbackCount: number,
): ReadonlyArray<TopicHubRoute> =>
  [...data.grouped.entries()].flatMap(([slug, entries]) =>
    buildTopicRoute({ slug, entries, data, graph, fallbackCount })
  )

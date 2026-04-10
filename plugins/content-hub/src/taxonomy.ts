import type { NormalizedEntry, TopicWithCount } from './types.ts'

export type { TaxonomyGraphModule } from './transform/ancestors.ts'

export type TopicHierarchyNode = {
  readonly slug: string
  readonly label: string
  readonly parent: string | undefined
  readonly children: ReadonlyArray<string>
  readonly count: number
}

type AncestorNode = {
  readonly slug: string
  readonly label: string
}


type GraphLike = {
  readonly ancestors: (slug: string) => ReadonlyArray<AncestorNode>
  readonly children?: (slug: string) => ReadonlyArray<AncestorNode>
  readonly edges: ReadonlyArray<unknown>
}

const incrementCount = (acc: ReadonlyMap<string, number>, slug: string): ReadonlyMap<string, number> =>
  new Map([...acc, [slug, (acc.get(slug) ?? 0) + 1]])

const countByResolvedTopic = (
  entries: ReadonlyArray<NormalizedEntry>,
): ReadonlyMap<string, number> =>
  entries
    .flatMap(entry => entry.resolvedTopics)
    .reduce(incrementCount, new Map<string, number>())

const DEFAULT_RELATED_LIMIT = 8

type RelatedTopicResult = { readonly slug: string; readonly label: string; readonly count: number }

const buildExcludedSet = (slug: string, graph: GraphLike | undefined): ReadonlySet<string> =>
  new Set<string>([
    slug,
    ...(graph === undefined ? [] : graph.ancestors(slug).map((a: AncestorNode) => a.slug)),
    ...(graph?.children === undefined ? [] : graph.children(slug).map((c: AncestorNode) => c.slug)),
  ])

const countCoOccurrences = (
  matching: ReadonlyArray<NormalizedEntry>,
  excluded: ReadonlySet<string>,
): ReadonlyMap<string, number> =>
  matching
    .flatMap(entry => entry.resolvedTopics)
    .filter(topic => !excluded.has(topic))
    .reduce(incrementCount, new Map<string, number>())

export const getRelatedTopics = (opts: {
  readonly slug: string
  readonly entries: ReadonlyArray<NormalizedEntry>
  readonly graph?: GraphLike
  readonly limit?: number
}): ReadonlyArray<RelatedTopicResult> => {
  const { slug, entries, graph, limit = DEFAULT_RELATED_LIMIT } = opts
  const matching = entries.filter(e => e.resolvedTopics.includes(slug))
  const excluded = buildExcludedSet(slug, graph)
  const coOccurrences = countCoOccurrences(matching, excluded)
  const topicMap = buildTopicMap(entries)

  return [...coOccurrences.entries()]
    .toSorted(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([topicSlug, count]) => ({
      slug: topicSlug,
      label: topicMap.get(topicSlug) ?? topicSlug,
      count,
    }))
}

const filterByTopicMap = (
  items: ReadonlyArray<{ readonly slug: string; readonly label: string }>,
  topicMap: ReadonlyMap<string, string> | undefined,
): ReadonlyArray<{ readonly slug: string; readonly label: string }> =>
  topicMap === undefined ? items : items.filter(c => topicMap.has(c.slug))

export const getChildTopics = (
  slug: string,
  graph: GraphLike | undefined,
  topicMap?: ReadonlyMap<string, string>,
): ReadonlyArray<{ readonly slug: string; readonly label: string }> => {
  if (graph?.children === undefined) return []
  const children = graph.children(slug).map(c => ({ slug: c.slug, label: c.label }))
  return filterByTopicMap(children, topicMap)
}

export const getSiblingTopics = (
  slug: string,
  graph: GraphLike | undefined,
  topicMap?: ReadonlyMap<string, string>,
): ReadonlyArray<{ readonly slug: string; readonly label: string }> => {
  if (graph === undefined) return []
  const parentChain = graph.ancestors(slug)
  if (parentChain.length === 0) return []

  const parent = parentChain[0]
  if (parent === undefined || graph.children === undefined) return []

  const siblings = graph.children(parent.slug)
    .filter(c => c.slug !== slug)
    .map(c => ({ slug: c.slug, label: c.label }))
  return filterByTopicMap(siblings, topicMap)
}

const buildFlatNode = (
  slug: string,
  topicMap: ReadonlyMap<string, string>,
  counts: ReadonlyMap<string, number>,
): TopicHierarchyNode => ({
  slug,
  label: topicMap.get(slug) ?? slug,
  parent: undefined,
  children: [],
  count: counts.get(slug) ?? 0,
})

const resolveParent = (parentChain: ReadonlyArray<AncestorNode>): string | undefined =>
  parentChain.length > 0 ? parentChain[0]?.slug : undefined

const resolveChildren = (
  graph: GraphLike,
  slug: string,
  topicMap: ReadonlyMap<string, string>,
): ReadonlyArray<string> =>
  (graph.children?.(slug) ?? []).map(c => c.slug).filter(c => topicMap.has(c))

type GraphNodeContext = {
  readonly slug: string
  readonly graph: GraphLike
  readonly topicMap: ReadonlyMap<string, string>
  readonly counts: ReadonlyMap<string, number>
}

const buildGraphNode = (ctx: GraphNodeContext): TopicHierarchyNode => ({
  slug: ctx.slug,
  label: ctx.topicMap.get(ctx.slug) ?? ctx.slug,
  parent: resolveParent(ctx.graph.ancestors(ctx.slug)),
  children: resolveChildren(ctx.graph, ctx.slug, ctx.topicMap),
  count: ctx.counts.get(ctx.slug) ?? 0,
})

export const getTopicHierarchy = (
  entries: ReadonlyArray<NormalizedEntry>,
  graph?: GraphLike,
): ReadonlyArray<TopicHierarchyNode> => {
  const topicMap = buildTopicMap(entries)
  const counts = countByResolvedTopic(entries)
  const slugs = [...topicMap.keys()]
  const mapper = graph === undefined
    ? (slug: string) => buildFlatNode(slug, topicMap, counts)
    : (slug: string) => buildGraphNode({ slug, graph, topicMap, counts })
  return slugs.map(mapper).toSorted((a, b) => b.count - a.count)
}

export const slugifyTopic = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')


type TopicSource = { readonly label: string; readonly fromVault: boolean }

// Internal tag instead of a bare boolean param
type TopicOrigin = { readonly kind: 'vault' } | { readonly kind: 'feed' }

const isVaultOrigin = (origin: TopicOrigin): boolean => origin.kind === 'vault'

const shouldExistingWin = (existing: TopicSource, candidate: TopicSource): boolean =>
  (existing.fromVault && !candidate.fromVault) ||
  (existing.fromVault === candidate.fromVault && existing.label <= candidate.label)

const upsertTopicFrom = (
  origin: TopicOrigin,
) => (
  map: ReadonlyMap<string, TopicSource>,
  topic: string,
): ReadonlyMap<string, TopicSource> => {
  const slug = slugifyTopic(topic)
  if (!slug) return map
  const candidate: TopicSource = { label: topic, fromVault: isVaultOrigin(origin) }
  const existing = map.get(slug)
  if (existing !== undefined && shouldExistingWin(existing, candidate)) return map
  return new Map([...map, [slug, candidate]])
}

const upsertVaultTopic = upsertTopicFrom({ kind: 'vault' })
const upsertFeedTopic = upsertTopicFrom({ kind: 'feed' })


// Label resolution priority:
// 1. Vault/local entries (no sourceLink) beat feed entries.
// 2. Within same source type, alphabetically-first original string wins.
export const buildTopicMap = (
  entries: ReadonlyArray<NormalizedEntry>,
): ReadonlyMap<string, string> => {
  const map = entries.reduce(
    (acc, entry) => {
      const upsert = entry.link === undefined ? upsertVaultTopic : upsertFeedTopic
      return entry.topics.reduce(upsert, acc)
    },
    new Map<string, TopicSource>() as ReadonlyMap<string, TopicSource>,
  )
  return new Map([...map.entries()].map(([slug, { label }]) => [slug, label]))
}


const compareByDateDesc = (a: NormalizedEntry, b: NormalizedEntry): number => {
  if (!a.date && !b.date) return 0
  if (!a.date) return 1
  if (!b.date) return -1
  return b.date.getTime() - a.date.getTime()
}


const addToBucket = (
  buckets: ReadonlyMap<string, ReadonlyArray<NormalizedEntry>>,
  entry: NormalizedEntry,
  topic: string,
): ReadonlyMap<string, ReadonlyArray<NormalizedEntry>> => {
  const slug = slugifyTopic(topic)
  if (!slug) return buckets
  const existing = buckets.get(slug)
  return new Map([
    ...buckets,
    [slug, existing === undefined ? [entry] : [...existing, entry]],
  ])
}


// Groups published entries by topic slug. An entry with N topics appears in N groups.
// Within each group, entries sort by date descending (undated entries sort last).
export const groupByTopic = (
  entries: ReadonlyArray<NormalizedEntry>,
): ReadonlyMap<string, ReadonlyArray<NormalizedEntry>> => {
  const buckets = entries.reduce(
    (acc, entry) =>
      entry.resolvedTopics.reduce(
        (inner, topic) => addToBucket(inner, entry, topic),
        acc,
      ),
    new Map<string, ReadonlyArray<NormalizedEntry>>() as ReadonlyMap<string, ReadonlyArray<NormalizedEntry>>,
  )
  return new Map(
    [...buckets.entries()].map(([slug, bucket]) => [slug, [...bucket].toSorted(compareByDateDesc)]),
  )
}


export const topicsWithCounts = (
  topicMap: ReadonlyMap<string, string>,
  grouped: ReadonlyMap<string, ReadonlyArray<NormalizedEntry>>,
): ReadonlyArray<TopicWithCount> =>
  [...topicMap.entries()]
    .map(([slug, label]) => ({ slug, label, count: grouped.get(slug)?.length ?? 0 }))
    .toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label))


export const entriesForTopic = (
  slug: string,
  grouped: ReadonlyMap<string, ReadonlyArray<NormalizedEntry>>,
): ReadonlyArray<NormalizedEntry> => grouped.get(slug) ?? []
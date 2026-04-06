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

const countByResolvedTopic = (
  entries: ReadonlyArray<NormalizedEntry>,
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const slug of entry.resolvedTopics) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
  }
  return counts
}

const DEFAULT_RELATED_LIMIT = 8

export const getRelatedTopics = (
  slug: string,
  entries: ReadonlyArray<NormalizedEntry>,
  graph?: GraphLike,
  limit = 8,
): ReadonlyArray<{ readonly slug: string; readonly label: string; readonly count: number }> => {
  const matching = entries.filter(e => e.resolvedTopics.includes(slug))

  const excluded = new Set<string>([
    slug,
    ...(graph !== undefined ? graph.ancestors(slug).map((a: AncestorNode) => a.slug) : []),
    ...(graph?.children !== undefined ? graph.children(slug).map((c: AncestorNode) => c.slug) : []),
  ])

  const coOccurrences = matching.reduce<ReadonlyMap<string, number>>(
    (acc, entry) =>
      entry.resolvedTopics
        .filter((t: string) => !excluded.has(t))
        .reduce<ReadonlyMap<string, number>>(
          (inner: ReadonlyMap<string, number>, topic: string) => new Map([...inner, [topic, (inner.get(topic) ?? 0) + 1]]),
          acc,
        ),
    new Map<string, number>(),
  )

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

export const getChildTopics = (
  slug: string,
  graph: GraphLike | undefined,
): ReadonlyArray<{ readonly slug: string; readonly label: string }> => {
  if (graph?.children === undefined) return []
  return graph.children(slug).map(c => ({ slug: c.slug, label: c.label }))
}

export const getSiblingTopics = (
  slug: string,
  graph: GraphLike | undefined,
): ReadonlyArray<{ readonly slug: string; readonly label: string }> => {
  if (graph === undefined) return []
  const parentChain = graph.ancestors(slug)
  if (parentChain.length === 0) return []

  const parent = parentChain[0]
  if (parent === undefined || graph.children === undefined) return []

  return graph.children(parent.slug)
    .filter(c => c.slug !== slug)
    .map(c => ({ slug: c.slug, label: c.label }))
}

export const getTopicHierarchy = (
  entries: ReadonlyArray<NormalizedEntry>,
  graph?: GraphLike,
): ReadonlyArray<TopicHierarchyNode> => {
  const topicMap = buildTopicMap(entries)
  const counts = countByResolvedTopic(entries)

  const slugs = [...topicMap.keys()]

  if (graph === undefined) {
    return slugs
      .map(slug => ({
        slug,
        label: topicMap.get(slug) ?? slug,
        parent: undefined as string | undefined,
        children: [] as ReadonlyArray<string>,
        count: counts.get(slug) ?? 0,
      }))
      .toSorted((a, b) => b.count - a.count)
  }

  return slugs
    .map(slug => {
      const parentChain = graph.ancestors(slug)
      const parent = parentChain.length > 0 ? (parentChain[0]?.slug ?? undefined) : undefined
      const children = (graph.children?.(slug) ?? [])
        .map(c => c.slug)
        .filter(c => topicMap.has(c))

      return {
        slug,
        label: topicMap.get(slug) ?? slug,
        parent,
        children,
        count: counts.get(slug) ?? 0,
      }
    })
    .toSorted((a, b) => b.count - a.count)
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
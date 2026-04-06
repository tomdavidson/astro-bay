import type { NormalizedEntry } from './types.ts'

export type RawEntry = {
  readonly id: string
  readonly data: Record<string, unknown>
  readonly rendered?: { readonly html?: string } | undefined
}

type GetCollection = (name: string) => Promise<ReadonlyArray<RawEntry>>

const resolveTopics = (
  data: Record<string, unknown>,
  topicsField: string,
  feedCategoryField: string,
): ReadonlyArray<string> => {
  const explicit = data[topicsField]
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.filter((t): t is string => typeof t === 'string')
  }
  const categories = data[feedCategoryField]
  if (Array.isArray(categories)) {
    return categories.filter((c): c is string => typeof c === 'string')
  }
  return []
}

const getString = (
  data: Record<string, unknown>,
  key: string,
): string | undefined =>
  typeof data[key] === 'string' ? data[key] : undefined

const getNonEmptyString = (
  data: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = getString(data, key)
  return value !== undefined && value.length > 0 ? value : undefined
}

const getStringArray = (
  data: Record<string, unknown>,
  key: string,
): ReadonlyArray<string> =>
  Array.isArray(data[key])
    ? (data[key] as readonly unknown[]).filter((value): value is string => typeof value === 'string')
    : []

const getSourceKind = (collectionName: string): NormalizedEntry['source'] =>
  collectionName === 'vault' || collectionName === 'feed' ? collectionName : 'custom'

export const normalizeEntry = (
  raw: RawEntry,
  collectionName: string,
  fields: { readonly topics: string; readonly feedCategory: string },
): { readonly entry: NormalizedEntry; readonly uidFallback: boolean } => {
  const data = raw.data
  const rawUid = getNonEmptyString(data, 'uid')
  const topics = resolveTopics(data, fields.topics, fields.feedCategory)

  return {
    entry: {
      uid: rawUid ?? raw.id,
      sourceId: raw.id,
      collectionName,
      title: getString(data, 'title') ?? raw.id,
      topics,
      resolvedTopics: [...topics],
      aliases: getStringArray(data, 'aliases'),
      date: data['date'] instanceof Date ? data['date'] : undefined,
      draft: typeof data['draft'] === 'boolean' ? data['draft'] : false,
      excerpt: getString(data, 'excerpt'),
      source: getSourceKind(collectionName),
      link: getString(data, 'link'),
      meta: {},
    },
    uidFallback: rawUid === undefined,
  }
}


export const aggregateEntries = async (
  collections: ReadonlyArray<string>,
  getCollection: GetCollection,
  fields = { topics: 'topics', feedCategory: 'categories' },
): Promise<ReadonlyArray<{ readonly entry: NormalizedEntry; readonly uidFallback: boolean }>> => {
  const results = await Promise.all(
    collections.map(async name => {
      const raw = await getCollection(name)
      return raw.map(r => normalizeEntry(r, name, fields))
    }),
  )
  return results.flat()
}

export const filterPublished = (
  entries: ReadonlyArray<NormalizedEntry>,
): ReadonlyArray<NormalizedEntry> => entries.filter(e => !e.draft)

export const sortByDate = (
  entries: ReadonlyArray<NormalizedEntry>,
): ReadonlyArray<NormalizedEntry> =>
  [...entries].toSorted((a, b) => {
    if (a.date === undefined && b.date === undefined) return 0
    if (a.date === undefined) return 1
    if (b.date === undefined) return -1
    return b.date.getTime() - a.date.getTime()
  })
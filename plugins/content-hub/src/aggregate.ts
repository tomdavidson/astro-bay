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

const getString = (data: Record<string, unknown>, key: string): string | undefined =>
  typeof data[key] === 'string' ? data[key] : undefined

const getNonEmptyString = (data: Record<string, unknown>, key: string): string | undefined => {
  const value = getString(data, key)
  return value !== undefined && value.length > 0 ? value : undefined
}

const getStringArray = (data: Record<string, unknown>, key: string): ReadonlyArray<string> =>
  Array.isArray(data[key]) ?
    (data[key] as readonly unknown[]).filter((value): value is string => typeof value === 'string') :
    []

const getSourceKind = (collectionName: string): NormalizedEntry['source'] =>
  collectionName === 'vault' || collectionName === 'feed' ? collectionName : 'custom'

type BuildEntryInput = {
  readonly raw: RawEntry
  readonly collectionName: string
  readonly topics: ReadonlyArray<string>
  readonly rawUid: string | undefined
}

const buildEntry = (input: BuildEntryInput): NormalizedEntry => ({
  uid: input.rawUid ?? input.raw.id,
  sourceId: input.raw.id,
  collectionName: input.collectionName,
  title: getString(input.raw.data, 'title') ?? input.raw.id,
  topics: input.topics,
  resolvedTopics: [...input.topics],
  aliases: getStringArray(input.raw.data, 'aliases'),
  date: input.raw.data['date'] instanceof Date ? input.raw.data['date'] : undefined,
  draft: typeof input.raw.data['draft'] === 'boolean' ? input.raw.data['draft'] : false,
  excerpt: getString(input.raw.data, 'excerpt'),
  source: getSourceKind(input.collectionName),
  link: getString(input.raw.data, 'link'),
  meta: {},
})

export const normalizeEntry = (
  raw: RawEntry,
  collectionName: string,
  fields: { readonly topics: string; readonly feedCategory: string },
): { readonly entry: NormalizedEntry; readonly uidFallback: boolean } => {
  const rawUid = getNonEmptyString(raw.data, 'uid')
  const topics = resolveTopics(raw.data, fields.topics, fields.feedCategory)
  return { entry: buildEntry({ raw, collectionName, topics, rawUid }), uidFallback: rawUid === undefined }
}

/* eslint-disable functional/prefer-readonly-type, functional/immutable-data, functional/no-expression-statements */
const dedupeBySourceId = (
  items: ReadonlyArray<{ readonly entry: NormalizedEntry; readonly uidFallback: boolean }>,
): ReadonlyArray<{ readonly entry: NormalizedEntry; readonly uidFallback: boolean }> =>
  items.reduce((state, item) => {
    const { out, seen } = state
    if (!seen.has(item.entry.sourceId)) {
      seen.add(item.entry.sourceId)
      out.push(item)
    }
    return state
  }, {
    out: [] as Array<{ readonly entry: NormalizedEntry; readonly uidFallback: boolean }>,
    seen: new Set<string>(),
  }).out
/* eslint-enable functional/prefer-readonly-type, functional/immutable-data, functional/no-expression-statements */

export const aggregateEntries = async (
  collections: ReadonlyArray<string>,
  getCollection: GetCollection,
  fields = { topics: 'topics', feedCategory: 'categories' },
): Promise<ReadonlyArray<{ readonly entry: NormalizedEntry; readonly uidFallback: boolean }>> => {
  const results = await Promise.all(collections.map(async name => {
    const raw = await getCollection(name)
    return raw.map(r => normalizeEntry(r, name, fields))
  }))

  return dedupeBySourceId(results.flat())
}

export const filterPublished = (entries: ReadonlyArray<NormalizedEntry>): ReadonlyArray<NormalizedEntry> =>
  entries.filter(e => !e.draft)

export const sortByDate = (entries: ReadonlyArray<NormalizedEntry>): ReadonlyArray<NormalizedEntry> =>
  [...entries].toSorted((a, b) => {
    if (a.date === undefined && b.date === undefined) return 0
    if (a.date === undefined) return 1
    if (b.date === undefined) return -1
    return b.date.getTime() - a.date.getTime()
  })

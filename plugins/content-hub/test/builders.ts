import type { NormalizedEntry } from '../src/types.ts'

export const buildEntryWithTopics = (
  topics: ReadonlyArray<string>,
  overrides?: Partial<NormalizedEntry>,
): NormalizedEntry => buildEntry({ topics, resolvedTopics: topics, ...overrides })

export const buildEntry = (overrides: Partial<NormalizedEntry> = {}): NormalizedEntry => ({
  uid: 'test-entry',
  sourceId: 'test-entry',
  collectionName: 'test-collection',
  title: 'Test Entry',
  topics: [],
  resolvedTopics: [],
  aliases: [],
  date: undefined,
  draft: false,
  excerpt: undefined,
  source: 'custom',
  link: undefined,
  meta: {},
  ...overrides,
})

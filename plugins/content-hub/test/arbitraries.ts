import fc from 'fast-check'
import type { NormalizedEntry } from '../src/types.ts'

// --- contentHubSchema arbitraries ---

// inputOf(contentHubSchema): fields with .default() or .optional() may be absent
export const arbHubInput = fc.record({
  uid: fc.option(fc.string(), { nil: undefined }),
  title: fc.string({ minLength: 1 }),
  topics: fc.array(fc.string()),
  aliases: fc.array(fc.string()),
  date: fc.option(fc.date(), { nil: undefined }),
  draft: fc.boolean(),
  excerpt: fc.option(fc.string(), { nil: undefined }),
}, { requiredKeys: ['title'] })

// outputOf(contentHubSchema): defaults are applied, so defaulted fields always present
export const arbHubOutput = fc.record({
  uid: fc.option(fc.string(), { nil: undefined }),
  title: fc.string({ minLength: 1 }),
  topics: fc.array(fc.string()),
  aliases: fc.array(fc.string()),
  date: fc.option(fc.date(), { nil: undefined }),
  draft: fc.boolean(),
  excerpt: fc.option(fc.string(), { nil: undefined }),
})

// --- feedEntrySchema arbitraries ---

// inputOf(feedEntrySchema)
export const arbFeedInput = fc.record({
  title: fc.string({ minLength: 1 }),
  topics: fc.array(fc.string()),
  aliases: fc.array(fc.string()),
  categories: fc.array(fc.string()),
  link: fc.webUrl(),
  date: fc.option(fc.date(), { nil: undefined }),
  draft: fc.boolean(),
  excerpt: fc.option(fc.string(), { nil: undefined }),
}, { requiredKeys: ['title', 'link'] })

// outputOf(feedEntrySchema)
export const arbFeedOutput = fc.record({
  title: fc.string({ minLength: 1 }),
  topics: fc.array(fc.string()),
  aliases: fc.array(fc.string()),
  categories: fc.array(fc.string()),
  link: fc.webUrl(),
  date: fc.option(fc.date(), { nil: undefined }),
  draft: fc.boolean(),
  excerpt: fc.option(fc.string(), { nil: undefined }),
})

// --- Hand-crafted arbitraries for normalized domain types ---

// oxlint-disable-next-line unicorn/prefer-spread
const SLUG_CHARS = Array.from('abcdefghijklmnopqrstuvwxyz0123456789-')
const slugChars = fc.constantFrom(...SLUG_CHARS)

export const slugArb = fc.stringOf(slugChars, { minLength: 1, maxLength: 30 }).filter(s =>
  !s.startsWith('-') && !s.endsWith('-') && !s.includes('--')
)

export const entryArb = fc.record<NormalizedEntry>({
  uid: slugArb,
  sourceId: slugArb,
  collectionName: fc.constantFrom('vault', 'feed', 'custom'),
  title: fc.string({ minLength: 1, maxLength: 80 }),
  topics: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  resolvedTopics: fc.constant([]),
  aliases: fc.array(slugArb, { minLength: 0, maxLength: 3 }),
  date: fc.option(fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }), {
    nil: undefined,
    freq: 3,
  }),
  draft: fc.boolean(),
  excerpt: fc.option(fc.string({ minLength: 10, maxLength: 200 }), { nil: undefined, freq: 3 }),
  source: fc.constantFrom('vault', 'feed', 'custom'),
  link: fc.option(fc.webUrl(), { nil: undefined, freq: 3 }),
  meta: fc.constant({}),
}).map(entry => ({ ...entry, resolvedTopics: [...entry.topics] }))

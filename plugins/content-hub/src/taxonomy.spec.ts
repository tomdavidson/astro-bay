import * as fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { isTddEnabled } from '../test/helpers.ts'
import { buildTopicMap, entriesForTopic, groupByTopic, slugifyTopic, topicsWithCounts } from './taxonomy.ts'
import type { NormalizedEntry } from './types.ts'

const tdd = isTddEnabled()

const e = (
  topics: ReadonlyArray<string>,
  link?: string,
  resolvedTopics: ReadonlyArray<string> = topics,
): NormalizedEntry => ({
  uid: 'x',
  sourceId: 'x',
  collectionName: 'c',
  title: 'X',
  topics,
  resolvedTopics,
  aliases: [],
  date: undefined,
  draft: false,
  excerpt: undefined,
  source: 'custom',
  link: link ?? undefined,
  meta: {},
})

const me = (
  uid: string,
  topics: ReadonlyArray<string>,
  date?: Date,
  resolvedTopics: ReadonlyArray<string> = topics,
): NormalizedEntry => ({
  uid,
  sourceId: uid,
  collectionName: 'c',
  title: uid,
  topics,
  resolvedTopics,
  aliases: [],
  date,
  draft: false,
  excerpt: undefined,
  source: 'custom',
  link: undefined,
  meta: {},
})

// Note: getRelatedTopics / getChildTopics / getSiblingTopics / getTopicHierarchy
// exercised astro-taxonomy graph internals, which content-hub does not own.
// Those belong in astro-taxonomy's own suite and have been removed here.

// ─── slugifyTopic — property tests ───────────────────────────────────────────

describe('slugifyTopic — property tests', () => {
  test.skipIf(!tdd)('idempotent', () => {
    fc.assert(fc.property(fc.string(), s => {
      const slug = slugifyTopic(s)
      expect(slugifyTopic(slug)).toBe(slug)
    }))
  })

  test.skipIf(!tdd)('output contains only valid chars [a-z0-9-]', () => {
    fc.assert(fc.property(fc.string(), s => {
      expect(/^[a-z0-9-]*$/.test(slugifyTopic(s))).toBe(true)
    }))
  })

  test.skipIf(!tdd)('no leading or trailing dashes', () => {
    fc.assert(fc.property(fc.string(), s => {
      const slug = slugifyTopic(s)
      expect(slug.startsWith('-')).toBe(false)
      expect(slug.endsWith('-')).toBe(false)
    }))
  })

  test.skipIf(!tdd)('no consecutive dashes', () => {
    fc.assert(fc.property(fc.string(), s => {
      expect(slugifyTopic(s).includes('--')).toBe(false)
    }))
  })

  test.skipIf(!tdd)('empty / whitespace-only input produces empty string', () => {
    fc.assert(fc.property(fc.constantFrom('', '   ', '\t', '\n'), s => slugifyTopic(s) === ''))
  })
})

// ─── slugifyTopic — basic assertions ────────────────────────────────────────

describe('slugifyTopic — basic assertions', () => {
  test('lowercases and replaces spaces with dashes', () => {
    expect(slugifyTopic('Urban Housing')).toBe('urban-housing')
  })

  test('strips diacritics', () => {
    expect(slugifyTopic('Café')).toBe('cafe')
  })

  test('collapses multiple spaces/dashes', () => {
    expect(slugifyTopic('foo  bar')).toBe('foo-bar')
    expect(slugifyTopic('foo--bar')).toBe('foo-bar')
  })

  test('empty string returns empty string', () => {
    expect(slugifyTopic('')).toBe('')
  })

  test('already-slug string is unchanged', () => {
    expect(slugifyTopic('rent-control')).toBe('rent-control')
  })
})

// ─── buildTopicMap ──────────────────────────────────────────────────────────

describe('buildTopicMap', () => {
  test('vault entries beat feed entries — vault label wins', () => {
    const m = buildTopicMap([e(['community gardens'], 'https://feed.example'), e(['Community Gardens'])])
    expect(m.get('community-gardens')).toBe('Community Gardens')
  })

  test('within same source, alphabetically first label wins', () => {
    expect(buildTopicMap([e(['Zoning']), e(['zoning'])]).get('zoning')).toBe('Zoning')
  })

  test('empty slug entries are excluded', () => {
    expect(buildTopicMap([e(['!!!'])]).size).toBe(0)
  })
})

// ─── groupByTopic ───────────────────────────────────────────────────────────

describe('groupByTopic', () => {
  test('entry with multiple topics appears in each group', () => {
    const g = groupByTopic([me('a', ['housing', 'zoning'])])
    expect(g.get('housing')).toHaveLength(1)
    expect(g.get('zoning')).toHaveLength(1)
  })

  test('entries are sorted by date descending within each group', () => {
    const g = groupByTopic([
      me('old', ['h'], new Date('2024-01-01')),
      me('new', ['h'], new Date('2025-01-01')),
    ])
    const entries = g.get('h')
    expect(entries).toBeDefined()
    if (!entries || entries.length === 0) return
    expect(entries[0]?.uid).toBe('new')
  })

  test('undated entries are sorted last', () => {
    const g = groupByTopic([me('undated', ['h']), me('dated', ['h'], new Date('2024-01-01'))])
    const entries = g.get('h')
    expect(entries).toBeDefined()
    if (!entries || entries.length === 0) return
    expect(entries[entries.length - 1]?.uid).toBe('undated')
  })

  test('entries with no topics are not grouped', () => {
    expect(groupByTopic([me('a', [])]).size).toBe(0)
  })
})

// ─── topicsWithCounts ────────────────────────────────────────────────────────

describe('topicsWithCounts', () => {
  test('count reflects grouped bucket size', () => {
    const entries = [
      e(['housing'], undefined, ['housing']),
      e(['housing'], undefined, ['housing']),
      e(['zoning'], undefined, ['zoning']),
    ]
    const topicMap = buildTopicMap(entries)
    const grouped = groupByTopic(entries)
    const result = topicsWithCounts(topicMap, grouped)
    expect(result.find(t => t.slug === 'housing')?.count).toBe(2)
    expect(result.find(t => t.slug === 'zoning')?.count).toBe(1)
  })

  test('sorted by count descending', () => {
    const entries = [e(['x'], undefined, ['x']), e(['y'], undefined, ['y']), e(['y'], undefined, ['y'])]
    const topicMap = buildTopicMap(entries)
    const grouped = groupByTopic(entries)
    const result = topicsWithCounts(topicMap, grouped)
    expect(result[0]!.slug).toBe('y')
  })

  test('topic with zero entries still included when present in topicMap', () => {
    const topicMap = new Map([['orphan', 'Orphan']])
    const grouped = new Map<string, readonly NormalizedEntry[]>()
    const result = topicsWithCounts(topicMap, grouped)
    expect(result).toHaveLength(1)
    expect(result[0]!.count).toBe(0)
  })

  test('empty inputs return empty array', () => {
    expect(topicsWithCounts(new Map(), new Map())).toEqual([])
  })
})

// ─── entriesForTopic ─────────────────────────────────────────────────────────

describe('entriesForTopic', () => {
  test('returns bucket for known slug', () => {
    const grouped = new Map<string, readonly NormalizedEntry[]>([['housing', [me('a', ['housing'])]]])
    expect(entriesForTopic('housing', grouped)).toHaveLength(1)
  })

  test('returns empty array for unknown slug', () => {
    expect(entriesForTopic('unknown', new Map())).toEqual([])
  })
})

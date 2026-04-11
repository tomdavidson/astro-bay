import * as fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { arbHubInput } from '../test/arbitraries.ts'
import { isTddEnabled } from '../test/helpers.ts'
import { aggregateEntries, filterPublished, normalizeEntry, sortByDate } from './aggregate.ts'
import type { RawEntry } from './aggregate.ts'

const tdd = isTddEnabled()

const FIELDS = { topics: 'topics', feedCategory: 'categories' } as const

const r = (id: string, data: Record<string, unknown>, rendered = false): RawEntry => ({
  id,
  data,
  rendered: rendered ? { html: '<p>x</p>' } : undefined,
})

// ─── normalizeEntry ──────────────────────────────────────────────────────────

describe('normalizeEntry', () => {
  test('categories fall back to topics for feed entries', () => {
    const { entry } = normalizeEntry(r('f1', { title: 'T', categories: ['news', 'tech'] }), 'sub', FIELDS)
    expect(entry.topics).toEqual(['news', 'tech'])
  })

  test('topics take priority over categories', () => {
    const { entry } = normalizeEntry(r('f2', { title: 'T', topics: ['x'], categories: ['y'] }), 'sub', FIELDS)
    expect(entry.topics).toEqual(['x'])
  })

  test('feed entry produces expected normalized shape', () => {
    const { entry } = normalizeEntry(r('f3', { title: 'T', link: 'https://example.com' }), 'feed', FIELDS)
    expect(entry).toMatchObject({
      sourceId: 'f3',
      collectionName: 'feed',
      source: 'feed',
      link: 'https://example.com',
    })
  })

  test('vault entry produces expected normalized shape', () => {
    const { entry } = normalizeEntry(r('v1', { title: 'T' }), 'vault', FIELDS)
    expect(entry).toMatchObject({ sourceId: 'v1', collectionName: 'vault', source: 'vault' })
  })

  test('draft is preserved', () => {
    expect(normalizeEntry(r('d', { uid: 'd', title: 'T', draft: true }), 'v', FIELDS).entry.draft).toBe(true)
  })

  test('missing title falls back to entry id', () => {
    expect(normalizeEntry(r('no-title', {}), 'v', FIELDS).entry.title).toBe('no-title')
  })
})

// ─── filterPublished ─────────────────────────────────────────────────────────

describe('filterPublished', () => {
  test('removes drafts', () => {
    const pub = normalizeEntry(r('a', { uid: 'a', title: 'A' }), 'c', FIELDS).entry
    const draft = normalizeEntry(r('b', { uid: 'b', title: 'B', draft: true }), 'c', FIELDS).entry
    const result = filterPublished([pub, draft])
    expect(result).toHaveLength(1)
    expect(result[0]!.uid).toBe('a')
  })
})

// ─── sortByDate ──────────────────────────────────────────────────────────────

describe('sortByDate', () => {
  test('newer first, undated last', () => {
    const make = (uid: string, date?: Date) => ({
      uid,
      sourceId: uid,
      collectionName: 'c',
      title: uid,
      date,
      topics: [] as readonly string[],
      resolvedTopics: [] as readonly string[],
      aliases: [] as readonly string[],
      draft: false,
      excerpt: undefined,
      source: 'custom' as const,
      link: undefined,
      meta: {},
    })
    const sorted = sortByDate([
      make('old', new Date('2023-01-01')),
      make('new', new Date('2025-01-01')),
      make('none'),
    ])
    expect(sorted[0]!.uid).toBe('new')
    expect(sorted[1]!.uid).toBe('old')
    expect(sorted[2]!.uid).toBe('none')
  })
})

// ─── aggregateEntries — deduplication ────────────────────────────────────────

describe('aggregateEntries', () => {
  test('deduplicates entries by sourceId', async () => {
    const gc = async (name: string) => {
      if (name === 'col-a') return [r('shared-id', { title: 'A' }), r('shared-id', { title: 'A2' })]
      return []
    }
    const results = await aggregateEntries(['col-a'], gc, FIELDS)
    expect(results).toHaveLength(1)
    expect(results[0]!.entry.title).toBe('A')
    expect(results[0]!.entry.sourceId).toBe('shared-id')
  })
})

// ─── property tests ──────────────────────────────────────────────────────────

describe('normalizeEntry — property tests', () => {
  test.skipIf(!tdd)(
    'for any valid schema input: uid is non-empty, topics is array, uidFallback is correct',
    () => {
      fc.assert(fc.property(arbHubInput, data => {
        const { entry, uidFallback } = normalizeEntry(
          r('fallback-id', data as Record<string, unknown>),
          'vault',
          FIELDS,
        )

        // uid is always a non-empty string
        expect(typeof entry.uid).toBe('string')
        expect(entry.uid.length).toBeGreaterThan(0)

        // topics is always an array
        expect(Array.isArray(entry.topics)).toBe(true)

        // uidFallback is true iff explicit uid was absent
        const hasExplicitUid = typeof data.uid === 'string' && data.uid.length > 0
        expect(uidFallback).toBe(!hasExplicitUid)
        if (!hasExplicitUid) {
          expect(entry.uid).toBe('fallback-id')
        }
      }))
    },
  )
})

describe('filterPublished — property tests', () => {
  test.skipIf(!tdd)('result is a strict subset with all draft === false', () => {
    fc.assert(fc.property(fc.array(arbHubInput, { minLength: 0, maxLength: 20 }), dataArr => {
      const entries = dataArr.map((data, i) =>
        normalizeEntry(r(`e${i}`, data as Record<string, unknown>), 'vault', FIELDS).entry
      )
      const published = filterPublished(entries)
      expect(published.length).toBeLessThanOrEqual(entries.length)
      expect(published.every(e => !e.draft)).toBe(true)
    }))
  })
})

describe('sortByDate — property tests', () => {
  test.skipIf(!tdd)('length preserved and dated entries precede undated', () => {
    fc.assert(fc.property(fc.array(arbHubInput, { minLength: 0, maxLength: 20 }), dataArr => {
      const entries = dataArr.map((data, i) =>
        normalizeEntry(r(`e${i}`, data as Record<string, unknown>), 'vault', FIELDS).entry
      )
      const sorted = sortByDate(entries)

      expect(sorted).toHaveLength(entries.length)

      let seenUndated = false
      for (const e of sorted) {
        if (!e.date) seenUndated = true
        if (seenUndated && e.date) {
          throw new Error('dated entry appeared after undated')
        }
      }
    }))
  })
})

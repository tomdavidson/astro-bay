import * as fc from 'fast-check'
import { describe, expect, it, test } from 'vitest'
import { entryArb } from '../test/arbitraries.ts'
import { buildEntry, buildEntryWithTopics } from '../test/builders.ts'
import { isTddEnabled } from '../test/helpers.ts'
import { createBrowseColumns, toBrowseData, toBrowseRow } from './browse.ts'

const tdd = isTddEnabled()

// ─── toBrowseRow ─────────────────────────────────────────────────────────────

describe('toBrowseRow', () => {
  it('extracts minimal fields from entry', () => {
    const date = new Date('2025-09-01T12:00:00Z')
    const entry = buildEntryWithTopics(['Astro', 'TypeScript'], {
      uid: 'my-post',
      title: 'My Post',
      date,
      excerpt: 'A short summary.',
      source: 'vault',
      aliases: ['old-slug'],
      meta: { custom: true },
    })

    const row = toBrowseRow(entry)

    expect(row).toEqual({
      uid: 'my-post',
      title: 'My Post',
      date: date.toISOString(),
      topics: ['Astro', 'TypeScript'],
      excerpt: 'A short summary.',
      source: 'vault',
    })
    expect(row).not.toHaveProperty('aliases')
    expect(row).not.toHaveProperty('meta')
    expect(row).not.toHaveProperty('resolvedTopics')
  })

  it('returns undefined date when entry has no date', () => {
    const row = toBrowseRow(buildEntry({ uid: 'undated', date: undefined }))
    expect(row.date).toBeUndefined()
  })

  it('returns undefined excerpt when entry has no excerpt', () => {
    const row = toBrowseRow(buildEntry({ uid: 'no-excerpt', excerpt: undefined }))
    expect(row.excerpt).toBeUndefined()
  })
})

// ─── toBrowseData ────────────────────────────────────────────────────────────

describe('toBrowseData', () => {
  it('maps all entries to BrowseRow array', () => {
    const entries = [
      buildEntry({ uid: 'a', title: 'A' }),
      buildEntry({ uid: 'b', title: 'B' }),
      buildEntry({ uid: 'c', title: 'C' }),
    ]
    const data = toBrowseData(entries)
    expect(data).toHaveLength(3)
    expect(data.map(r => r.uid)).toEqual(['a', 'b', 'c'])
  })

  it('returns empty array for empty input', () => {
    expect(toBrowseData([])).toEqual([])
  })
})

// ─── createBrowseColumns ─────────────────────────────────────────────────────
// Deleted: "covers all BrowseRow keys" — subsumed by property test below.
// Deleted: "marks date as sortable" — asserts hardcoded config constant.
// Deleted: "marks topics as filterable" — asserts hardcoded config constant.

describe('createBrowseColumns', () => {
  test.skipIf(tdd)('property: all BrowseRow keys covered by columns', () => {
    fc.assert(fc.property(entryArb, entry => {
      const row = toBrowseRow(entry)
      const columns = createBrowseColumns()
      const columnIds = new Set(columns.map(c => c.id))
      return Object.keys(row).every(k => columnIds.has(k))
    }))
  })
})

// ─── toBrowseData — property tests ───────────────────────────────────────────

describe('toBrowseData — property tests', () => {
  test.skipIf(!tdd)('JSON roundtrip preserves all uids', () => {
    fc.assert(fc.property(fc.array(entryArb, { minLength: 0, maxLength: 10 }), entries => {
      const rows = toBrowseData(entries)
      const parsed = JSON.parse(JSON.stringify(rows)) as readonly { readonly uid: string }[]
      const originalUids = entries.map(e => e.uid).toSorted()
      const parsedUids = parsed.map(r => r.uid).toSorted()
      expect(parsedUids).toEqual(originalUids)
    }))
  })
})

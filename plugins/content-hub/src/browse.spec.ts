import { describe, it, expect, test } from 'vitest'
import { toBrowseRow, toBrowseData, createBrowseColumns } from './browse.ts'
import { buildEntry, buildEntryWithTopics } from '../test/builders.ts'
import { isTddEnabled } from '../test/helpers.ts'
import * as fc from 'fast-check'

const tdd = isTddEnabled()

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

  it('returns null date when entry has no date', () => {
    const entry = buildEntry({ uid: 'undated', date: undefined })
    const row = toBrowseRow(entry)
    expect(row.date).toBeUndefined()
  })

  it('returns null excerpt when entry has no excerpt', () => {
    const entry = buildEntry({ uid: 'no-excerpt', excerpt: undefined })
    const row = toBrowseRow(entry)
    expect(row.excerpt).toBeUndefined()
  })
})

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

describe('createBrowseColumns', () => {
  it('covers all BrowseRow keys', () => {
    const columns = createBrowseColumns()
    const columnIds = columns.map(c => c.id)
    const expectedKeys: readonly string[] = ['uid', 'title', 'date', 'topics', 'excerpt', 'source']

    for (const key of expectedKeys) {
      expect(columnIds).toContain(key)
    }
  })

  it('marks date as sortable', () => {
    const columns = createBrowseColumns()
    const dateCol = columns.find(c => c.id === 'date')
    expect(dateCol?.enableSorting).toBe(true)
  })

  it('marks topics as filterable', () => {
    const columns = createBrowseColumns()
    const topicsCol = columns.find(c => c.id === 'topics')
    expect(topicsCol?.enableColumnFilter).toBe(true)
  })

  test.skipIf(tdd)('property: all BrowseRow keys covered by columns', () => {
    fc.assert(
      fc.property(
        fc.record({
          uid: fc.string({ minLength: 1 }),
          title: fc.string({ minLength: 1 }),
          date: fc.oneof(fc.constant(), fc.date().map(d => d.toISOString())),
          topics: fc.array(fc.string({ minLength: 1 })),
          excerpt: fc.oneof(fc.constant(), fc.string()),
          source: fc.constantFrom('vault', 'feed', 'custom'),
        }),
        (row) => {
          const columns = createBrowseColumns()
          const columnIds = new Set(columns.map(c => c.id))
          return Object.keys(row).every(k => columnIds.has(k))
        },
      ),
    )
  })
})

import { test, expect, describe } from 'vitest'
import { filterPublished, normalizeEntry, sortByDate } from './aggregate'
import type { RawEntry } from './aggregate'
import { NormalizedEntry } from './types'

const r = (id: string, data: Record<string, unknown>, rendered = false): RawEntry =>
  ({ id, data, rendered: rendered ? { html: '<p>x</p>' } : undefined })

describe('normalizeEntry', () => {
  test('normalizeEntry_withUid_usesExplicitUid', () => {
    const { entry, uidFallback } = normalizeEntry(r('id-1', { uid: 'my-uid', title: 'T' }), 'vault', { topics: 'topics', feedCategory: 'categories' })
    expect(entry.uid).toBe('my-uid')
    expect(uidFallback).toBe(false)
  })
  test('normalizeEntry_withoutUid_fallsBackToId', () => {
    const { entry, uidFallback } = normalizeEntry(r('entry-id', { title: 'T' }), 'vault', { topics: 'topics', feedCategory: 'categories' })
    expect(entry.uid).toBe('entry-id')
    expect(uidFallback).toBe(true)
  })
  test('normalizeEntry_feedEntry_categoriesFallback', () => {
    const { entry } = normalizeEntry(r('f1', { title: 'T', categories: ['news', 'tech'] }), 'sub', { topics: 'topics', feedCategory: 'categories' })
    expect(entry.topics).toEqual(['news', 'tech'])
  })
  test('normalizeEntry_topicsTakePriorityOverCategories', () => {
    const { entry } = normalizeEntry(r('f2', { title: 'T', topics: ['x'], categories: ['y'] }), 'sub', { topics: 'topics', feedCategory: 'categories' })
    expect(entry.topics).toEqual(['x'])
  })
  test('normalizeEntry_feedEntry_populatesSourceIdFromEntryId', () => {
    const { entry } = normalizeEntry(r('f3', { title: 'T', link: 'https://example.com' }), 'feed', { topics: 'topics', feedCategory: 'categories' })
    expect(entry.sourceId).toBe('f3')
    expect(entry.collectionName).toBe('feed')
    expect(entry.source).toBe('feed')
    expect(entry.link).toBe('https://example.com')
  })
  test('normalizeEntry_vaultEntry_populatesSourceIdFromEntryId', () => {
    const { entry } = normalizeEntry(r('v1', { title: 'T' }), 'vault', { topics: 'topics', feedCategory: 'categories' })
    expect(entry.sourceId).toBe('v1')
    expect(entry.collectionName).toBe('vault')
    expect(entry.source).toBe('vault')
  })

  test('normalizeEntry_draft_preserved', () => {
    expect(normalizeEntry(r('d', { uid: 'd', title: 'T', draft: true }), 'v', { topics: 'topics', feedCategory: 'categories' }).entry.draft).toBe(true)
  })
  test('normalizeEntry_missingTitle_fallsBackToId', () => {
    expect(normalizeEntry(r('no-title', {}), 'v', { topics: 'topics', feedCategory: 'categories' }).entry.title).toBe('no-title')
  })
})

describe('filterPublished', () => {
  test('filterPublished_removesDrafts', () => {
    const pub = normalizeEntry(r('a', { uid: 'a', title: 'A' }), 'c', { topics: 'topics', feedCategory: 'categories' }).entry
    const draft = normalizeEntry(r('b', { uid: 'b', title: 'B', draft: true }), 'c', { topics: 'topics', feedCategory: 'categories' }).entry
    const result = filterPublished([pub, draft])
    expect(result).toHaveLength(1)
    expect(result[0]!.uid).toBe('a')
  })
})

describe('sortByDate', () => {
  test('sortByDate_mixedDates_newerFirstUndatedLast', () => {
    const make = (uid: string, date?: Date): NormalizedEntry => ({
      uid, sourceId: uid, collectionName: 'c', title: uid, date, topics: [], aliases: [], draft: false,
      excerpt: undefined, source: 'custom', link: undefined, meta: {},
    })
    const sorted = sortByDate([make('old', new Date('2023-01-01')), make('new', new Date('2025-01-01')), make('none')])
    expect(sorted[0]!.uid).toBe('new')
    expect(sorted[1]!.uid).toBe('old')
    expect(sorted[2]!.uid).toBe('none')
  })
})

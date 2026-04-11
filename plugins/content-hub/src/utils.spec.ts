import * as fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { entryArb } from '../test/arbitraries.ts'
import { buildEntry } from '../test/builders.ts'
import { isTddEnabled } from '../test/helpers.ts'
import { toFeedItems, toRssItem } from './utils.ts'

const tdd = isTddEnabled()

const ARTICLE_BASE = 'articles'

// ─── toRssItem ───────────────────────────────────────────────────────────────

describe('toRssItem', () => {
  test('maps all entry fields to RSS item shape', () => {
    const date = new Date('2025-03-01')
    const entry = buildEntry({
      uid: 'my-post',
      title: 'My Post',
      excerpt: 'A short description',
      date,
      topics: ['housing', 'zoning'],
    })
    const item = toRssItem(entry, ARTICLE_BASE)
    expect(item).toMatchObject({
      title: 'My Post',
      description: 'A short description',
      pubDate: date,
      categories: ['housing', 'zoning'],
    })
    expect(item.link).toContain('my-post')
  })

  test('pubDate is undefined when entry has no date', () => {
    const entry = buildEntry({ uid: 'a', date: undefined })
    expect(toRssItem(entry, ARTICLE_BASE).pubDate).toBeUndefined()
  })
})

// ─── toFeedItems ─────────────────────────────────────────────────────────────

describe('toFeedItems', () => {
  test('excludes draft entries', () => {
    const entries = [buildEntry({ uid: 'pub', draft: false }), buildEntry({ uid: 'draft', draft: true })]
    const items = toFeedItems(entries, ARTICLE_BASE)
    expect(items).toHaveLength(1)
    expect(items[0]!.link).toContain('pub')
  })

  test('excludes feed-origin entries (no re-syndication)', () => {
    const entries = [
      buildEntry({ uid: 'vault-post', source: 'vault' }),
      buildEntry({ uid: 'feed-post', source: 'feed', link: 'https://external.example' }),
    ]
    const items = toFeedItems(entries, ARTICLE_BASE)
    expect(items).toHaveLength(1)
    expect(items[0]!.link).toContain('vault-post')
  })

  test('empty entries returns empty array', () => {
    expect(toFeedItems([], ARTICLE_BASE)).toHaveLength(0)
  })
})

describe('toFeedItems — property tests', () => {
  test.skipIf(!tdd)('output is subset: no drafts, no feed-origin', () => {
    fc.assert(fc.property(fc.array(entryArb, { minLength: 0, maxLength: 20 }), entries => {
      const items = toFeedItems(entries, ARTICLE_BASE)
      expect(items.length).toBeLessThanOrEqual(entries.length)

      const publishedNonFeed = entries.filter(e => !e.draft && e.source !== 'feed')
      expect(items).toHaveLength(publishedNonFeed.length)
    }))
  })
})

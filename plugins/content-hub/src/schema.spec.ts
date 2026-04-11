/**
 * Schema contract tests — the Zod schemas are the source of truth for field
 * names, types, and defaults.  Tests here verify the *contract* callers
 * depend on (required fields, critical defaults, feed-entry shape) rather
 * than re-asserting Zod built-in behaviour (.optional(), .default(), etc.).
 * Property tests use the schema-derived arbitraries from test/arbitraries.ts.
 */

import * as fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { arbFeedInput, arbHubInput, arbHubOutput } from '../test/arbitraries.ts'
import { isTddEnabled } from '../test/helpers.ts'
import { contentHubSchema, feedEntrySchema } from './schema.ts'

const tdd = isTddEnabled()

describe('contentHubSchema', () => {
  test('parses minimal valid object (title only)', () => {
    expect(contentHubSchema.safeParse({ title: 'Hello World' }).success).toBe(true)
  })

  test('title is required — missing title fails', () => {
    expect(contentHubSchema.safeParse({}).success).toBe(false)
  })
})

describe('feedEntrySchema', () => {
  test('parses minimal feed entry (title + link)', () => {
    expect(feedEntrySchema.safeParse({ title: 'Feed Item', link: 'https://example.com' }).success).toBe(true)
  })

  test('categories is content-hub extension — defaults to empty array', () => {
    const result = feedEntrySchema.safeParse({ title: 'T', link: 'https://example.com' })
    if (result.success) expect(result.data.categories).toEqual([])
  })
})

describe('contentHubSchema — property tests', () => {
  test.skipIf(!tdd)('any generated input parses successfully', () => {
    fc.assert(fc.property(arbHubInput, input => {
      expect(contentHubSchema.safeParse(input).success).toBe(true)
    }))
  })

  test.skipIf(!tdd)('output always has required shape keys', () => {
    fc.assert(fc.property(arbHubOutput, data => {
      expect(typeof data.title).toBe('string')
      expect(typeof data.draft).toBe('boolean')
      expect(Array.isArray(data.topics)).toBe(true)
      expect(Array.isArray(data.aliases)).toBe(true)
    }))
  })
})

describe('feedEntrySchema — property tests', () => {
  test.skipIf(!tdd)('any generated input parses successfully', () => {
    fc.assert(fc.property(arbFeedInput, input => {
      expect(feedEntrySchema.safeParse(input).success).toBe(true)
    }))
  })
})

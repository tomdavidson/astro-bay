import { describe, expect, test } from 'vitest'
import { runTransforms } from '../transform/pipeline.ts'
import type { EntryTransform, NormalizedEntry, TransformContext } from '../types.ts'

const makeEntry = (overrides: Partial<NormalizedEntry> = {}): NormalizedEntry => ({
  uid: 'a',
  sourceId: 'a',
  collectionName: 'vault',
  title: 'Original',
  topics: [],
  resolvedTopics: [],
  aliases: [],
  date: undefined,
  draft: false,
  excerpt: undefined,
  source: 'vault',
  link: undefined,
  meta: {},
  ...overrides,
})

const makeCtx = (
  allEntries: ReadonlyArray<NormalizedEntry>,
): TransformContext => ({
  allEntries,
  siteUrl: 'https://example.com',
  cache: new Map(),
})

describe('runTransforms', () => {
  test('applies transforms in order', async () => {
    const entry = makeEntry()

    const addTopic: EntryTransform = async current => ({
      ...current,
      topics: [...current.topics, 'housing'],
    })

    const rename: EntryTransform = async current => ({
      ...current,
      title: `${current.title} updated`,
    })

    const result = await runTransforms([entry], [addTopic, rename], makeCtx([entry]))

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]!.title).toBe('Original updated')
    expect(result.entries[0]!.topics).toEqual(['housing'])
    expect(result.warnings).toEqual([])
  })

  test('runs transforms sequentially per entry', async () => {
    const entry = makeEntry()
    const seen: string[] = []

    const first: EntryTransform = async current => {
      seen.push(`first:${current.title}`)
      return { ...current, title: `${current.title}-1` }
    }

    const second: EntryTransform = async current => {
      seen.push(`second:${current.title}`)
      return { ...current, title: `${current.title}-2` }
    }

    const result = await runTransforms([entry], [first, second], makeCtx([entry]))

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]!.title).toBe('Original-1-2')
    expect(seen).toEqual(['first:Original', 'second:Original-1'])
    expect(result.warnings).toEqual([])
  })

  test('failing transform preserves original entry and returns warning', async () => {
    const entry = makeEntry()

    const boom: EntryTransform = () => {
      throw new Error('boom')
    }

    const result = await runTransforms([entry], [boom], makeCtx([entry]))

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toEqual(entry)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]!.uid).toBe('a')
    expect(String(result.warnings[0]!.cause)).toContain('boom')
  })

  test('after failure keeps original for that step then continues chain', async () => {
    const entry = makeEntry()

    const boom: EntryTransform = () => {
      throw new Error('boom')
    }

    const rename: EntryTransform = async current => ({
      ...current,
      title: 'Recovered',
    })

    const result = await runTransforms([entry], [boom, rename], makeCtx([entry]))

    expect(result.entries[0]!.title).toBe('Recovered')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]!.uid).toBe('a')
  })
})
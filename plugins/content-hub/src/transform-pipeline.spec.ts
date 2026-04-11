import { describe, expect, test } from 'vitest'
import { buildEntry } from '../test/builders.ts'
import { runTransforms } from './transform/pipeline.ts'
import type { EntryTransform, NormalizedEntry, TransformContext } from './types.ts'

const makeCtx = (allEntries: readonly NormalizedEntry[] = []): TransformContext => ({
  allEntries,
  siteUrl: 'https://example.com',
  cache: new Map<string, unknown>(),
})

describe('runTransforms', () => {
  test('applies transforms sequentially, each sees previous output', async () => {
    const entry = buildEntry({ uid: 'a', topics: [] })
    const ctx = makeCtx([entry])

    const addX: EntryTransform = current => ({ ...current, topics: [...current.topics, 'x'] })
    const addY: EntryTransform = current => ({ ...current, topics: [...current.topics, 'y'] })

    const result = await runTransforms([entry], [addX, addY], ctx)

    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]!.topics).toEqual(['x', 'y'])
    expect(result.warnings).toEqual([])
  })

  test('returns same entry count when transforms succeed', async () => {
    const entries = [buildEntry({ uid: 'a' }), buildEntry({ uid: 'b' }), buildEntry({ uid: 'c' })]
    const ctx = makeCtx(entries)
    const identity: EntryTransform = current => current

    const result = await runTransforms(entries, [identity], ctx)

    expect(result.entries).toHaveLength(3)
    expect(result.warnings).toEqual([])
  })

  test('failing transform on one entry does not affect others', async () => {
    const entries = [buildEntry({ uid: 'ok' }), buildEntry({ uid: 'bad' })]
    const ctx = makeCtx(entries)

    const conditionalBoom: EntryTransform = current => {
      if (current.uid === 'bad') throw new Error('intentional')
      return { ...current, meta: { ...current.meta, processed: true } }
    }

    const result = await runTransforms(entries, [conditionalBoom], ctx)
    const okEntry = result.entries.find((entry: NormalizedEntry) => entry.uid === 'ok')
    const badEntry = result.entries.find((entry: NormalizedEntry) => entry.uid === 'bad')

    expect(okEntry!.meta['processed']).toBe(true)
    expect(badEntry!.meta['processed']).toBeUndefined()
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]!.uid).toBe('bad')
  })

  test('no transforms returns original entries', async () => {
    const entries = [buildEntry({ uid: 'a' }), buildEntry({ uid: 'b' })]
    const ctx = makeCtx(entries)

    const result = await runTransforms(entries, [], ctx)

    expect(result.entries).toHaveLength(2)
    expect(result.entries[0]).toBe(entries[0])
    expect(result.entries[1]).toBe(entries[1])
    expect(result.warnings).toEqual([])
  })

  test('empty entries returns empty result', async () => {
    const result = await runTransforms([], [], makeCtx())

    expect(result.entries).toEqual([])
    expect(result.warnings).toEqual([])
  })

  test('draft true set by transform is preserved', async () => {
    const entry = buildEntry({ uid: 'a', draft: false })
    const ctx = makeCtx([entry])
    const suppress: EntryTransform = current => ({ ...current, draft: true })

    const result = await runTransforms([entry], [suppress], ctx)

    expect(result.entries[0]!.draft).toBe(true)
    expect(result.warnings).toEqual([])
  })
})

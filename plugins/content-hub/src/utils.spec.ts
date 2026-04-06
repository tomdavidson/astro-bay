import { describe, expect, test } from 'vitest'
import { runTransforms, runTransformsDetailed, toRssItem, toFeedItems } from './utils.ts'
import type { EntryTransform, NormalizedEntry, TransformContext } from './types.ts'

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

const makeCtx = (allEntries: ReadonlyArray<NormalizedEntry>): TransformContext => ({
    allEntries,
    siteUrl: 'https://example.com',
    cache: new Map(),
})

describe('utils.runTransforms', () => {
    test('returns only transformed entries for backward compatibility', async () => {
        const entry = makeEntry()
        const addTopic: EntryTransform = async current => ({
            ...current,
            topics: ['housing'],
        })

        const result = await runTransforms([entry], [addTopic], makeCtx([entry]))

        expect(result).toEqual([
            {
                ...entry,
                topics: ['housing'],
            },
        ])
    })

    test('preserves old surface by not returning warnings object', async () => {
        const entry = makeEntry()

        const result = await runTransforms([entry], [], makeCtx([entry]))

        expect(Array.isArray(result)).toBe(true)
        expect(result).toEqual([entry])
    })

    test('returns original entry when a transform fails', async () => {
        const entry = makeEntry()
        const boom: EntryTransform = () => {
            throw new Error('boom')
        }

        const result = await runTransforms([entry], [boom], makeCtx([entry]))

        expect(result).toEqual([entry])
    })

    test('continues transform chain after a failure using original entry for that step', async () => {
        const entry = makeEntry()
        const boom: EntryTransform = () => {
            throw new Error('boom')
        }
        const rename: EntryTransform = async current => ({
            ...current,
            title: 'Recovered',
        })

        const result = await runTransforms([entry], [boom, rename], makeCtx([entry]))

        expect(result).toEqual([
            {
                ...entry,
                title: 'Recovered',
            },
        ])
    })
})

describe('utils.toRssItem', () => {
    test('uses authored topics, not resolvedTopics', () => {
        const entry = makeEntry({
            uid: 'rent-control',
            title: 'Rent Control 101',
            topics: ['rent-control'],
            resolvedTopics: ['rent-control', 'housing', 'housing-policy'],
            date: new Date('2026-01-15'),
            excerpt: 'A primer on rent control.',
        })

        const item = toRssItem(entry, 'articles')

        expect(item.title).toBe('Rent Control 101')
        expect(item.link).toBe('/articles/rent-control')
        expect(item.description).toBe('A primer on rent control.')
        expect(item.categories).toEqual(['rent-control'])
        expect(item.pubDate).toEqual(new Date('2026-01-15'))
    })

    test('defaults description to empty string when no excerpt', () => {
        const entry = makeEntry({ excerpt: undefined })
        const item = toRssItem(entry, 'articles')
        expect(item.description).toBe('')
    })
})

describe('utils.toFeedItems', () => {
    test('excludes drafts and feed-origin entries', () => {
        const entries = [
            makeEntry({ uid: 'a', title: 'Published', draft: false, source: 'vault' }),
            makeEntry({ uid: 'b', title: 'Draft', draft: true, source: 'vault' }),
            makeEntry({ uid: 'c', title: 'Feed', draft: false, source: 'feed' }),
            makeEntry({ uid: 'd', title: 'Custom', draft: false, source: 'custom' }),
        ]

        const items = toFeedItems(entries, 'articles')

        expect(items).toHaveLength(2)
        expect(items.map((i) => i.title)).toEqual(['Published', 'Custom'])
    })

    test('maps remaining entries through toRssItem', () => {
        const entries = [
            makeEntry({
                uid: 'x',
                title: 'X',
                topics: ['housing'],
                date: new Date('2026-03-01'),
                excerpt: 'About X.',
                source: 'vault',
            }),
        ]

        const items = toFeedItems(entries, 'writing')

        expect(items).toHaveLength(1)
        expect(items[0]!.link).toBe('/writing/x')
        expect(items[0]!.categories).toEqual(['housing'])
        expect(items[0]!.description).toBe('About X.')
    })

    test('returns empty array when all entries are filtered out', () => {
        const entries = [
            makeEntry({ uid: 'a', draft: true, source: 'vault' }),
            makeEntry({ uid: 'b', draft: false, source: 'feed' }),
        ]

        expect(toFeedItems(entries, 'articles')).toEqual([])
    })
})

describe('utils.runTransformsDetailed', () => {
    test('returns entries and warnings', async () => {
        const entry = makeEntry()
        const boom: EntryTransform = () => {
            throw new Error('boom')
        }

        const result = await runTransformsDetailed([entry], [boom], makeCtx([entry]))

        expect(result.entries).toEqual([entry])
        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0]?.uid).toBe('a')
        expect(String(result.warnings[0]?.cause)).toContain('boom')
    })

    test('matches runTransforms entries output for the same inputs', async () => {
        const entries = [
            makeEntry({ uid: 'a', sourceId: 'a', title: 'A' }),
            makeEntry({ uid: 'b', sourceId: 'b', title: 'B' }),
        ]
        const rename: EntryTransform = async current => ({
            ...current,
            title: `${current.title} updated`,
        })

        const legacy = await runTransforms(entries, [rename], makeCtx(entries))
        const detailed = await runTransformsDetailed(entries, [rename], makeCtx(entries))

        expect(detailed.entries).toEqual(legacy)
        expect(detailed.warnings).toEqual([])
    })

    test('accumulates warnings across multiple failing entries', async () => {
        const entries = [
            makeEntry({ uid: 'a', sourceId: 'a' }),
            makeEntry({ uid: 'b', sourceId: 'b' }),
        ]
        const boom: EntryTransform = current => {
            throw new Error(`boom:${current.uid}`)
        }

        const result = await runTransformsDetailed(entries, [boom], makeCtx(entries))

        expect(result.entries).toEqual(entries)
        expect(result.warnings).toHaveLength(2)
        expect(result.warnings.map(w => w.uid)).toEqual(['a', 'b'])
        expect(result.warnings.map(w => String(w.cause))).toEqual(
            expect.arrayContaining([
                expect.stringContaining('boom:a'),
                expect.stringContaining('boom:b'),
            ]),
        )
    })

    test('accumulates warnings across multiple failing transforms on one entry', async () => {
        const entry = makeEntry()
        const boom1: EntryTransform = () => {
            throw new Error('boom-1')
        }
        const boom2: EntryTransform = () => {
            throw new Error('boom-2')
        }

        const result = await runTransformsDetailed([entry], [boom1, boom2], makeCtx([entry]))

        expect(result.entries).toEqual([entry])
        expect(result.warnings).toHaveLength(2)
        expect(result.warnings.map(w => String(w.cause))).toEqual([
            expect.stringContaining('boom-1'),
            expect.stringContaining('boom-2'),
        ])
    })
})
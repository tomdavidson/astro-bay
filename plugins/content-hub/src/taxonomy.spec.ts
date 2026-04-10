import { test, expect, describe } from 'vitest'
import { slugifyTopic, buildTopicMap, groupByTopic, getRelatedTopics, getChildTopics, getSiblingTopics, getTopicHierarchy } from './taxonomy.ts'
import type { NormalizedEntry } from './types.ts'


const isTddEnabled = (): boolean =>
  process.env['TDD'] === '1'

const tdd = isTddEnabled()


const e = (topics: ReadonlyArray<string>, link?: string, resolvedTopics: ReadonlyArray<string> = topics): NormalizedEntry => ({
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

describe('getRelatedTopics', () => {
  const eResolved = (
    uid: string,
    resolvedTopics: ReadonlyArray<string>,
  ) => me(uid, resolvedTopics, undefined, resolvedTopics)

  test('returns co-occurring topics sorted by count', () => {
    const entries = [
      eResolved('a', ['housing', 'zoning', 'transit']),
      eResolved('b', ['housing', 'zoning']),
      eResolved('c', ['housing', 'parks']),
    ]
    const result = getRelatedTopics({ slug: 'housing', entries })
    expect(result[0]?.slug).toBe('zoning')
    expect(result[0]?.count).toBe(2)
    expect(result[1]?.slug).toBe('transit')
  })

  test('excludes the input topic itself', () => {
    const entries = [eResolved('a', ['housing', 'zoning'])]
    const result = getRelatedTopics({ slug: 'housing', entries })
    expect(result.every(r => r.slug !== 'housing')).toBe(true)
  })

  test('excludes children and ancestors when graph provided', () => {
    const entries = [
      eResolved('a', ['housing', 'rent-control', 'policy']),
    ]
    const graph = {
      edges: [{}],
      ancestors: (slug: string) =>
        slug === 'housing' ? [{ slug: 'policy', label: 'Policy' }] : [],
      children: (slug: string) =>
        slug === 'housing' ? [{ slug: 'rent-control', label: 'Rent Control' }] : [],
    }
    const result = getRelatedTopics({ slug: 'housing', entries, graph })
    expect(result.every(r => r.slug !== 'policy')).toBe(true)
    expect(result.every(r => r.slug !== 'rent-control')).toBe(true)
  })

  test('caps at limit', () => {
    const topics = Array.from({ length: 20 }, (_, i) => `topic-${i}`)
    const entries = [eResolved('a', ['target', ...topics])]
    const result = getRelatedTopics({ slug: 'target', entries, limit: 5 })
    expect(result).toHaveLength(5)
  })

  test('works without graph (flat topics)', () => {
    const entries = [eResolved('a', ['x', 'y']), eResolved('b', ['x', 'z'])]
    const result = getRelatedTopics({ slug: 'x', entries })
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('getChildTopics', () => {
  test('returns direct children', () => {
    const graph = {
      edges: [{}],
      ancestors: () => [],
      children: (slug: string) =>
        slug === 'housing'
          ? [{ slug: 'rent-control', label: 'Rent Control' }, { slug: 'zoning', label: 'Zoning' }]
          : [],
    }
    const result = getChildTopics('housing', graph)
    expect(result).toHaveLength(2)
    expect(result[0]?.slug).toBe('rent-control')
  })

  test('returns empty for leaf topic', () => {
    const graph = {
      edges: [{}],
      ancestors: () => [],
      children: () => [],
    }
    expect(getChildTopics('leaf', graph)).toEqual([])
  })

  test('returns empty when graph is undefined', () => {
    expect(getChildTopics("anything", undefined)).toEqual([])
  })

  test('filters to published topics when topicMap provided', () => {
    const graph = {
      edges: [{}],
      ancestors: () => [],
      children: (slug: string) =>
        slug === 'housing'
          ? [{ slug: 'rent-control', label: 'Rent Control' }, { slug: 'ghost-topic', label: 'Ghost' }]
          : [],
    }
    const topicMap = new Map([['rent-control', 'Rent Control']])
    const result = getChildTopics('housing', graph, topicMap)
    expect(result).toHaveLength(1)
    expect(result[0]?.slug).toBe('rent-control')
  })

  test('returns all children when topicMap omitted', () => {
    const graph = {
      edges: [{}],
      ancestors: () => [],
      children: (slug: string) =>
        slug === 'housing'
          ? [{ slug: 'rent-control', label: 'Rent Control' }, { slug: 'ghost-topic', label: 'Ghost' }]
          : [],
    }
    const result = getChildTopics('housing', graph)
    expect(result).toHaveLength(2)
  })
})

describe('getSiblingTopics', () => {
  test('returns parent\'s other children', () => {
    const graph = {
      edges: [{}],
      ancestors: (slug: string) =>
        slug === 'rent-control' ? [{ slug: 'housing', label: 'Housing' }] : [],
      children: (slug: string) =>
        slug === 'housing'
          ? [
              { slug: 'rent-control', label: 'Rent Control' },
              { slug: 'zoning', label: 'Zoning' },
              { slug: 'tenant-rights', label: 'Tenant Rights' },
            ]
          : [],
    }
    const result = getSiblingTopics('rent-control', graph)
    expect(result).toHaveLength(2)
    expect(result.map(s => s.slug)).toEqual(['zoning', 'tenant-rights'])
  })

  test('returns empty when no parent', () => {
    const graph = {
      edges: [{}],
      ancestors: () => [],
      children: () => [],
    }
    expect(getSiblingTopics('root-topic', graph)).toEqual([])
  })

  test('returns empty when graph is undefined', () => {
    expect(getSiblingTopics("anything", undefined)).toEqual([])
  })

  test('filters to published topics when topicMap provided', () => {
    const graph = {
      edges: [{}],
      ancestors: (slug: string) =>
        slug === 'rent-control' ? [{ slug: 'housing', label: 'Housing' }] : [],
      children: (slug: string) =>
        slug === 'housing'
          ? [
              { slug: 'rent-control', label: 'Rent Control' },
              { slug: 'zoning', label: 'Zoning' },
              { slug: 'ghost-topic', label: 'Ghost' },
            ]
          : [],
    }
    const topicMap = new Map([['rent-control', 'Rent Control'], ['zoning', 'Zoning']])
    const result = getSiblingTopics('rent-control', graph, topicMap)
    expect(result).toHaveLength(1)
    expect(result[0]?.slug).toBe('zoning')
  })
})

describe('getTopicHierarchy', () => {
  const eResolved = (
    uid: string,
    topics: ReadonlyArray<string>,
    resolvedTopics: ReadonlyArray<string>,
  ) => me(uid, topics, undefined, resolvedTopics)

  test('counts include child entries via resolvedTopics', () => {
    const entries = [
      eResolved('a', ['rent-control'], ['rent-control', 'housing']),
      eResolved('b', ['zoning'], ['zoning', 'housing']),
      eResolved('c', ['housing'], ['housing']),
    ]
    const result = getTopicHierarchy(entries)
    const housing = result.find(n => n.slug === 'housing')
    expect(housing?.count).toBe(3)
  })

  test('flat list when no graph', () => {
    const entries = [
      eResolved('a', ['housing'], ['housing']),
      eResolved('b', ['zoning'], ['zoning']),
    ]
    const result = getTopicHierarchy(entries)
    expect(result.every(n => n.parent === undefined)).toBe(true)
    expect(result.every(n => n.children.length === 0)).toBe(true)
  })

  test('populates parent and children when graph provided', () => {
    const entries = [
      eResolved('a', ['rent-control'], ['rent-control', 'housing']),
      eResolved('b', ['housing'], ['housing']),
    ]
    const graph = {
      edges: [{}],
      ancestors: (slug: string) =>
        slug === 'rent-control' ? [{ slug: 'housing', label: 'Housing' }] : [],
      children: (slug: string) =>
        slug === 'housing'
          ? [{ slug: 'rent-control', label: 'Rent Control' }]
          : [],
    }
    const result = getTopicHierarchy(entries, graph)
    const housing = result.find(n => n.slug === 'housing')
    const rentControl = result.find(n => n.slug === 'rent-control')
    expect(housing?.children).toContain('rent-control')
    expect(rentControl?.parent).toBe('housing')
  })

  test('sorted by count descending', () => {
    const entries = [
      eResolved('a', ['rare'], ['rare']),
      eResolved('b', ['common'], ['common']),
      eResolved('c', ['common'], ['common']),
    ]
    const result = getTopicHierarchy(entries)
    expect(result[0]?.slug).toBe('common')
  })
})


const me = (uid: string, topics: ReadonlyArray<string>, date?: Date, resolvedTopics: ReadonlyArray<string> = topics): NormalizedEntry => ({
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


describe('slugifyTopic', () => {
  test('slugifyTopic_ascii_lowercaseDash', () => {
    expect(slugifyTopic('Community Gardens')).toBe('community-gardens')
  })

  test('slugifyTopic_accents_stripped', () => {
    expect(slugifyTopic('Résumé')).toBe('resume')
  })

  test('slugifyTopic_onlySymbols_emptyString', () => {
    expect(slugifyTopic('---!!!')).toBe('')
  })

  test('slugifyTopic_alreadySlug_unchanged', () => {
    expect(slugifyTopic('community-gardens')).toBe('community-gardens')
  })

  test.skipIf(!tdd)('slugifyTopic_idempotent', async () => {
    const fc = await import('fast-check')
    fc.assert(fc.property(fc.string(), (s) =>
      slugifyTopic(s) === slugifyTopic(slugifyTopic(s)),
    ))
  })

  test.skipIf(!tdd)('slugifyTopic_outputOnlyValidChars', async () => {
    const fc = await import('fast-check')
    fc.assert(fc.property(fc.string(), (s) =>
      /^[a-z0-9-]*$/.test(slugifyTopic(s)),
    ))
  })

  test.skipIf(!tdd)('slugifyTopic_noLeadingOrTrailingDashes', async () => {
    const fc = await import('fast-check')
    fc.assert(fc.property(fc.string(), (s) => {
      const slug = slugifyTopic(s)
      return !slug.startsWith('-') && !slug.endsWith('-')
    }))
  })

  test.skipIf(!tdd)('slugifyTopic_noConsecutiveDashes', async () => {
    const fc = await import('fast-check')
    fc.assert(fc.property(fc.string(), (s) =>
      !slugifyTopic(s).includes('--'),
    ))
  })
})


describe('buildTopicMap', () => {
  test('buildTopicMap_vaultBeatsFeed_vaultLabelWins', () => {
    const m = buildTopicMap([
      e(['community gardens'], 'https://feed.example'),
      e(['Community Gardens']),
    ])
    expect(m.get('community-gardens')).toBe('Community Gardens')
  })

  test('buildTopicMap_sameSource_alphabeticallyFirstWins', () => {
    expect(
      buildTopicMap([e(['Zoning']), e(['zoning'])]).get('zoning'),
    ).toBe('Zoning')
  })

  test('buildTopicMap_emptySlug_excluded', () => {
    expect(buildTopicMap([e(['!!!'])]).size).toBe(0)
  })
})


describe('groupByTopic', () => {
  test('groupByTopic_multipleTopics_entryInEachGroup', () => {
    const g = groupByTopic([me('a', ['housing', 'zoning'])])
    expect(g.get('housing')).toHaveLength(1)
    expect(g.get('zoning')).toHaveLength(1)
  })

  test('groupByTopic_dateSort_newerFirst', () => {
    const g = groupByTopic([
      me('old', ['h'], new Date('2024-01-01')),
      me('new', ['h'], new Date('2025-01-01')),
    ])
    const entries = g.get('h')
    expect(entries).toBeDefined()
    if (!entries || entries.length === 0) return
    expect(entries[0]?.uid).toBe('new')
  })

  test('groupByTopic_undated_last', () => {
    const g = groupByTopic([
      me('undated', ['h']),
      me('dated', ['h'], new Date('2024-01-01')),
    ])
    const entries = g.get('h')
    expect(entries).toBeDefined()
    if (!entries || entries.length === 0) return
    expect(entries[entries.length - 1]?.uid).toBe('undated')
  })

  test('groupByTopic_noTopics_notGrouped', () => {
    expect(groupByTopic([me('a', [])]).size).toBe(0)
  })
})

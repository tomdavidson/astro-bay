import { describe, expect, test } from 'vitest'
import { buildArticleIndexRoutes, buildTopicHubRoutes, buildTopicRoute } from './static-paths.ts'
import { buildEntry, buildEntryWithTopics } from '../../test/builders.ts'
import type { HubData } from '../types.ts'
import { buildTopicMap, groupByTopic } from '../taxonomy.ts'
import { filterPublished, sortByDate } from '../aggregate.ts'

const makeHubData = (entries: ReturnType<typeof buildEntry>[]): HubData => {
  const published = sortByDate(filterPublished(entries))
  return {
    raw: entries,
    transformed: entries,
    published,
    topicMap: buildTopicMap(entries),
    grouped: groupByTopic(published),
    uidMap: new Map(entries.map(e => [e.uid, e])),
  }
}

describe('buildArticleIndexRoutes', () => {
  test('returns exactly one route', () => {
    const data = makeHubData([buildEntry({ uid: 'a', title: 'A' })])
    const routes = buildArticleIndexRoutes(data, 10)
    expect(routes).toHaveLength(1)
    expect(routes[0]!.params).toEqual({})
  })

  test('props.entries contains all published entries', () => {
    const entries = [
      buildEntry({ uid: 'a', draft: false }),
      buildEntry({ uid: 'b', draft: false }),
      buildEntry({ uid: 'c', draft: true }),
    ]
    const data = makeHubData(entries)
    const [route] = buildArticleIndexRoutes(data, 10)
    expect(route!.props.entries).toHaveLength(2)
    expect(route!.props.entries.map(e => e.uid)).toEqual(expect.arrayContaining(['a', 'b']))
  })

  test('props.fallbackEntries is sliced to staticFallbackCount', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      buildEntry({ uid: `e${i}`, draft: false })
    )
    const data = makeHubData(entries)
    const [route] = buildArticleIndexRoutes(data, 3)
    expect(route!.props.fallbackEntries).toHaveLength(3)
  })

  test('props.fallbackEntries equals entries when count >= total', () => {
    const entries = [buildEntry({ uid: 'x' }), buildEntry({ uid: 'y' })]
    const data = makeHubData(entries)
    const [route] = buildArticleIndexRoutes(data, 20)
    expect(route!.props.fallbackEntries).toHaveLength(route!.props.entries.length)
  })

  test('entries are sorted by date descending', () => {
    const entries = [
      buildEntry({ uid: 'old', date: new Date('2023-01-01'), draft: false }),
      buildEntry({ uid: 'new', date: new Date('2025-01-01'), draft: false }),
    ]
    const data = makeHubData(entries)
    const [route] = buildArticleIndexRoutes(data, 10)
    expect(route!.props.entries[0]!.uid).toBe('new')
    expect(route!.props.entries[1]!.uid).toBe('old')
  })
})

describe('buildTopicRoute', () => {
  test('returns a route with params.topic = slug', () => {
    const e = buildEntryWithTopics(['housing'], { uid: 'a', draft: false })
    const data = makeHubData([e])
    const [route] = buildTopicRoute({ slug: 'housing', entries: [e], data, graph: undefined, fallbackCount: 10 })
    expect(route!.params.topic).toBe('housing')
  })

  test('props.entries contains all passed entries', () => {
    const entries = [
      buildEntryWithTopics(['housing'], { uid: 'a' }),
      buildEntryWithTopics(['housing'], { uid: 'b' }),
    ]
    const data = makeHubData(entries)
    const [route] = buildTopicRoute({ slug: 'housing', entries, data, graph: undefined, fallbackCount: 10 })
    expect(route!.props.entries).toHaveLength(2)
  })

  test('props.fallbackEntries sliced to fallbackCount', () => {
    const entries = Array.from({ length: 6 }, (_, i) =>
      buildEntryWithTopics(['housing'], { uid: `e${i}` })
    )
    const data = makeHubData(entries)
    const [route] = buildTopicRoute({ slug: 'housing', entries, data, graph: undefined, fallbackCount: 4 })
    expect(route!.props.fallbackEntries).toHaveLength(4)
  })

  test('props.label falls back to slug when not in topicMap', () => {
    const data = makeHubData([])
    const [route] = buildTopicRoute({ slug: 'unknown-slug', entries: [], data, graph: undefined, fallbackCount: 5 })
    expect(route!.props.label).toBe('unknown-slug')
  })

  test('props.label uses topicMap display label when available', () => {
    const e = buildEntryWithTopics(['Urban Housing'], { uid: 'a' })
    const data = makeHubData([e])
    const [route] = buildTopicRoute({ slug: 'urban-housing', entries: [e], data, graph: undefined, fallbackCount: 5 })
    expect(route!.props.label).toBe('Urban Housing')
  })

  test('props.ancestorChain is empty without graph', () => {
    const data = makeHubData([])
    const [route] = buildTopicRoute({ slug: 'housing', entries: [], data, graph: undefined, fallbackCount: 5 })
    expect(route!.props.ancestorChain).toEqual([])
  })

  test('props.ancestorChain uses graph.ancestors when present', () => {
    const data = makeHubData([])
    const graph = { ancestors: (_slug: string) => [{ slug: 'real-estate', label: 'Real Estate' }], edges: [] }
    const [route] = buildTopicRoute({ slug: 'housing', entries: [], data, graph, fallbackCount: 5 })
    expect(route!.props.ancestorChain).toEqual([{ slug: 'real-estate', label: 'Real Estate' }])
  })
})

describe('buildTopicHubRoutes', () => {
  test('returns one route per unique topic', () => {
    const entries = [
      buildEntryWithTopics(['housing', 'zoning'], { uid: 'a', draft: false }),
      buildEntryWithTopics(['housing'], { uid: 'b', draft: false }),
    ]
    const data = makeHubData(entries)
    const routes = buildTopicHubRoutes(data, undefined, 10)
    const slugs = routes.map(r => r.params.topic)
    expect(slugs).toHaveLength(2)
    expect(slugs).toContain('housing')
    expect(slugs).toContain('zoning')
  })

  test('returns empty array when no grouped entries', () => {
    const data = makeHubData([])
    expect(buildTopicHubRoutes(data, undefined, 10)).toEqual([])
  })

  test('housing route props.entries contains both entries', () => {
    const entries = [
      buildEntryWithTopics(['housing'], { uid: 'a', draft: false }),
      buildEntryWithTopics(['housing'], { uid: 'b', draft: false }),
    ]
    const data = makeHubData(entries)
    const routes = buildTopicHubRoutes(data, undefined, 10)
    const housingRoute = routes.find(r => r.params.topic === 'housing')
    expect(housingRoute!.props.entries).toHaveLength(2)
  })
})

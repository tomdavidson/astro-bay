import { describe, expect, test } from 'vitest'
import { buildEntry, buildEntryWithTopics } from '../../test/builders.ts'
import { filterPublished, sortByDate } from '../aggregate.ts'
import { buildTopicMap, getTopicHierarchy, groupByTopic } from '../taxonomy.ts'
import type { HubData } from '../types.ts'
import { buildArticleIndexRoutes, buildTopicHubRoutes, buildTopicRoute } from './static-paths.ts'

const makeHubData = (entries: readonly ReturnType<typeof buildEntry>[]): HubData => {
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
    const entries = Array.from({ length: 5 }, (_, i) => buildEntry({ uid: `e${i}`, draft: false }))
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
    const [route] = buildTopicRoute({
      slug: 'housing',
      entries: [e],
      data,
      graph: undefined,
      fallbackCount: 10,
    })
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
    const entries = Array.from({ length: 6 }, (_, i) => buildEntryWithTopics(['housing'], { uid: `e${i}` }))
    const data = makeHubData(entries)
    const [route] = buildTopicRoute({ slug: 'housing', entries, data, graph: undefined, fallbackCount: 4 })
    expect(route!.props.fallbackEntries).toHaveLength(4)
  })

  test('props.label falls back to slug when not in topicMap', () => {
    const data = makeHubData([])
    const [route] = buildTopicRoute({
      slug: 'unknown-slug',
      entries: [],
      data,
      graph: undefined,
      fallbackCount: 5,
    })
    expect(route!.props.label).toBe('unknown-slug')
  })

  test('props.label uses topicMap display label when available', () => {
    const e = buildEntryWithTopics(['Urban Housing'], { uid: 'a' })
    const data = makeHubData([e])
    const [route] = buildTopicRoute({
      slug: 'urban-housing',
      entries: [e],
      data,
      graph: undefined,
      fallbackCount: 5,
    })
    expect(route!.props.label).toBe('Urban Housing')
  })

  test('props.ancestorChain is empty without graph', () => {
    const data = makeHubData([])
    const [route] = buildTopicRoute({
      slug: 'housing',
      entries: [],
      data,
      graph: undefined,
      fallbackCount: 5,
    })
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

describe('hierarchy alignment: TopicIndex and TopicHub agree on children', () => {
  const graph = {
    edges: [{}],
    ancestors: (slug: string) => {
      if (slug === 'rent-control') return [{ slug: 'housing', label: 'Housing' }]
      if (slug === 'ghost-child') return [{ slug: 'housing', label: 'Housing' }]
      return []
    },
    children: (slug: string) =>
      slug === 'housing' ?
        [{ slug: 'rent-control', label: 'Rent Control' }, { slug: 'ghost-child', label: 'Ghost Child' }] :
        [],
  }

  test('parent TopicIndex node and parent TopicHub route list the same children', () => {
    // ghost-child has no entries, so it should be excluded from both
    const entries = [
      buildEntryWithTopics(['Housing'], { uid: 'a', draft: false, resolvedTopics: ['housing'] }),
      buildEntryWithTopics(['Rent Control'], {
        uid: 'b',
        draft: false,
        resolvedTopics: ['rent-control', 'housing'],
      }),
    ]
    const data = makeHubData(entries)

    // TopicIndex path: getTopicHierarchy
    const hierarchy = getTopicHierarchy(data.published, graph)
    const housingNode = hierarchy.find(n => n.slug === 'housing')
    const indexChildren = housingNode?.children ?? []

    // TopicHub path: buildTopicHubRoutes
    const routes = buildTopicHubRoutes(data, graph, 10)
    const housingRoute = routes.find(r => r.params.topic === 'housing')
    const hubChildren = housingRoute?.props.children.map(c => c.slug) ?? []

    // Both should list rent-control and exclude ghost-child
    expect(indexChildren).toEqual(['rent-control'])
    expect(hubChildren).toEqual(['rent-control'])
    expect(indexChildren).toEqual(hubChildren)
  })

  test('flat hierarchy without graph: both return no children', () => {
    const entries = [
      buildEntryWithTopics(['Housing'], { uid: 'a', draft: false, resolvedTopics: ['housing'] }),
      buildEntryWithTopics(['Rent Control'], { uid: 'b', draft: false, resolvedTopics: ['rent-control'] }),
    ]
    const data = makeHubData(entries)

    const hierarchy = getTopicHierarchy(data.published)
    const housingNode = hierarchy.find(n => n.slug === 'housing')
    expect(housingNode?.children).toEqual([])

    const routes = buildTopicHubRoutes(data, undefined, 10)
    const housingRoute = routes.find(r => r.params.topic === 'housing')
    expect(housingRoute?.props.children).toEqual([])
  })
})

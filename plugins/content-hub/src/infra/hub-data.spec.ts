import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ResolvedConfig } from '../config.ts'
import { getHubData, clearHubCache } from './hub-data.ts'
import { registerTransforms, resetTransformRegistry } from './integration.ts'

const warn = vi.fn<(msg: string) => void>()
const info = vi.fn<(msg: string) => void>()

const logger = { warn, info }

const runtime = (command: string) => ({ logger, command })

const baseConfig: ResolvedConfig = {
  name: 'test',
  collections: ['vault'],
  layout: undefined,
  drafts: { showInDev: true },
  taxonomy: {
    field: 'topics',
    feedCategoryField: 'categories',
    route: 'topics',
    indexPage: true,
  },
  permalinks: {
    field: 'uid',
    aliasField: 'aliases',
    articleBase: 'articles',
  },
  pagination: { pageSize: 20 },
  browse: { pageSize: 20 },
  jsonld: { enabled: true },
  locale: { lang: 'en', dateLocale: 'en-US', indexTitle: 'Articles', topicIndexTitle: 'Topics' },
  transforms: [],
  siteUrl: 'https://example.com',
}

const makeGetCollection = (
  entries: ReadonlyArray<{ readonly id: string; readonly data: Record<string, unknown> }>,
) => async (_name: string) =>
    Promise.resolve(entries.map(e => ({
      id: e.id,
      data: e.data,
      rendered: undefined,
    })))

beforeEach(() => {
  clearHubCache()
  resetTransformRegistry()
  warn.mockReset()
  info.mockReset()
})

describe('getHubData', () => {
  test('getHubData_singleCollection_returnsHubData', async () => {
    const gc = makeGetCollection([
      { id: 'p1', data: { uid: 'p1', title: 'Post 1', topics: ['housing'] } },
      { id: 'p2', data: { uid: 'p2', title: 'Post 2', topics: ['zoning'] } },
    ])

    const data = await getHubData(baseConfig, gc, runtime('build'))

    expect(data.published).toHaveLength(2)
    expect(data.uidMap.has('p1')).toBe(true)
    expect(data.uidMap.has('p2')).toBe(true)
  })

  test('getHubData_draftEntries_excludedFromPublished', async () => {
    const gc = makeGetCollection([
      { id: 'pub', data: { uid: 'pub', title: 'Pub', draft: false } },
      { id: 'draft', data: { uid: 'draft', title: 'Draft', draft: true } },
    ])

    const data = await getHubData(baseConfig, gc, runtime('build'))

    expect(data.published).toHaveLength(1)
    expect(data.published[0]!.uid).toBe('pub')
    expect(data.raw).toHaveLength(2)
  })

  test('getHubData_topicMap_containsSluggedTopics', async () => {
    const gc = makeGetCollection([
      { id: 'a', data: { uid: 'a', title: 'A', topics: ['Urban Housing'] } },
    ])

    const data = await getHubData(baseConfig, gc, runtime('build'))

    expect(data.topicMap.has('urban-housing')).toBe(true)
  })

  test('getHubData_groupedByTopic_correctCounts', async () => {
    const gc = makeGetCollection([
      { id: 'a', data: { uid: 'a', title: 'A', topics: ['housing', 'zoning'] } },
      { id: 'b', data: { uid: 'b', title: 'B', topics: ['housing'] } },
    ])

    const data = await getHubData(baseConfig, gc, runtime('build'))

    expect(data.grouped.get('housing')).toHaveLength(2)
    expect(data.grouped.get('zoning')).toHaveLength(1)
  })

  test('getHubData_cachedOnSecondCall_sameReference', async () => {
    const gc = makeGetCollection([{ id: 'a', data: { uid: 'a', title: 'A' } }])

    const d1 = await getHubData(baseConfig, gc, runtime('build'))
    const d2 = await getHubData(baseConfig, gc, runtime('build'))

    expect(d1).toBe(d2)
  })

  test('getHubData_uidCollision_throws', async () => {
    const gc = makeGetCollection([
      { id: 'a', data: { uid: 'same', title: 'A' } },
      { id: 'b', data: { uid: 'same', title: 'B' } },
    ])

    await expect(
      getHubData(baseConfig, gc, runtime('build')),
    ).rejects.toThrow('UID collision')
  })

  test('getHubData_userTransform_applied', async () => {
    const gc = makeGetCollection([{ id: 'a', data: { uid: 'a', title: 'original' } }])

    const config: ResolvedConfig = {
      ...baseConfig,
      name: 'transform-test',
      transforms: [async (entry) => ({ ...entry, title: 'transformed' })],
    }

    const data = await getHubData(config, gc, runtime('build'))
    expect(data.published[0]!.title).toBe('transformed')
  })

  test('getHubData_failingTransform_preservesOriginalEntry_andLogsWarning', async () => {
    const gc = makeGetCollection([{ id: 'a', data: { uid: 'a', title: 'original' } }])

    const config: ResolvedConfig = {
      ...baseConfig,
      name: 'safe-transform-test',
    transforms: [() => { throw new Error('boom') }],
  }

    const data = await getHubData(config, gc, runtime('build'))

    expect(data.published[0]!.title).toBe('original')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toContain('transform error')
    expect(warn.mock.calls[0]![0]).toContain('"a"')
    expect(warn.mock.calls[0]![0]).toContain('boom')
  })

  test('getHubData_feedEntry_categoriesMappedToTopics', async () => {
    const gc = makeGetCollection([
      {
        id: 'f1',
        data: {
          uid: 'f1',
          title: 'Post',
          categories: ['policy', 'housing'],
          link: 'https://example.com',
        },
      },
    ])

    const data = await getHubData(baseConfig, gc, runtime('build'))

    expect(data.topicMap.has('policy')).toBe(true)
    expect(data.topicMap.has('housing')).toBe(true)
  })

  test('getHubData_transformsFromRegistry_runWhenConfigTransformsEmpty', async () => {
    const addEnriched = (entry: any) => ({
      ...entry,
      meta: { ...entry.meta, enriched: true },
    })

    registerTransforms('registry-test', [addEnriched])

    const config: ResolvedConfig = {
      ...baseConfig,
      name: 'registry-test',
      transforms: [],
    }

    const gc = makeGetCollection([
      { id: 'a', data: { uid: 'a', title: 'A', topics: ['housing'] } },
    ])

    const data = await getHubData(config, gc, runtime('build'))

    expect(data.published[0]!.meta?.enriched).toBe(true)
  })

  test('getHubData_noRegisteredTransforms_noConfigTransforms_stillBuilds', async () => {
    const config: ResolvedConfig = {
      ...baseConfig,
      name: 'no-transforms',
      transforms: [],
    }

    const gc = makeGetCollection([{ id: 'a', data: { uid: 'a', title: 'A' } }])

    const data = await getHubData(config, gc, runtime('build'))

    expect(data.published).toHaveLength(1)
  })

  test('getHubData_devMode_includesDraftsInPublished', async () => {
    const gc = makeGetCollection([
      { id: 'pub', data: { uid: 'pub', title: 'Pub', draft: false } },
      { id: 'draft', data: { uid: 'draft', title: 'Draft', draft: true } },
    ])

    const data = await getHubData(baseConfig, gc, runtime('dev'))

    expect(data.published).toHaveLength(2)
    const draft = data.published.find(e => e.uid === 'draft')
    expect(draft?.meta?.isDraftPreview).toBe(true)
  })

  test('getHubData_devModeShowInDevFalse_excludesDrafts', async () => {
    const config: ResolvedConfig = {
      ...baseConfig,
      drafts: { showInDev: false },
    }

    const gc = makeGetCollection([
      { id: 'pub', data: { uid: 'pub', title: 'Pub', draft: false } },
      { id: 'draft', data: { uid: 'draft', title: 'Draft', draft: true } },
    ])

    const data = await getHubData(config, gc, runtime('dev'))

    expect(data.published).toHaveLength(1)
    expect(data.published[0]!.uid).toBe('pub')
    expect(data.published[0]!.title).toBe('Pub')
  })
})
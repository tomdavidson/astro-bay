import { describe, expect, test } from 'vitest'
import { resolveConfig } from './config.ts'
import { expectOk } from '../test/helpers.ts'



describe('resolveConfig', () => {
  test('resolveConfig_appliesDefaults', () => {
    const config = expectOk(resolveConfig({ collections: ['vault'] }))

    expect(config.name).toBe('default')
    expect(config.collections).toEqual(['vault'])
    expect(config.layout).toBeUndefined()
    expect(config.drafts.showInDev).toBe(true)

    expect(config.taxonomy).toEqual({
      field: 'topics',
      feedCategoryField: 'categories',
      route: 'topics',
      indexPage: true,
    })

    expect(config.permalinks).toEqual({
      field: 'uid',
      aliasField: 'aliases',
      articleBase: 'articles',
    })

    expect(config.pagination).toEqual({ pageSize: 20 })
    expect(config.browse).toEqual({ pageSize: 20 })
    expect(config.jsonld).toEqual({ enabled: true })

    expect(config.locale).toEqual({
      lang: 'en',
      dateLocale: 'en-US',
      indexTitle: 'Articles',
      topicIndexTitle: 'Topics',
    })

    expect(config.transforms).toEqual([])
  })



  test('resolveConfig_partialNestedOverrides_mergeWithDefaults', () => {
    const config = expectOk(
      resolveConfig({
        collections: ['vault'],
        drafts: { showInDev: false },
        taxonomy: { route: 'subjects' },
        permalinks: { articleBase: 'writing' },
        pagination: { pageSize: 50 },
        locale: { lang: 'fr' },
      }),
    )

    expect(config.drafts.showInDev).toBe(false)

    expect(config.taxonomy).toEqual({
      field: 'topics',
      feedCategoryField: 'categories',
      route: 'subjects',
      indexPage: true,
    })

    expect(config.permalinks).toEqual({
      field: 'uid',
      aliasField: 'aliases',
      articleBase: 'writing',
    })

    expect(config.pagination).toEqual({ pageSize: 50 })
    expect(config.locale).toEqual({
      lang: 'fr',
      dateLocale: 'en-US',
      indexTitle: 'Writing',
      topicIndexTitle: 'Topics',
    })
  })



  test('resolveConfig_indexTitleDefaultsToCapitalizedArticleBase', () => {
    const config = expectOk(
      resolveConfig({
        collections: ['vault'],
        permalinks: { articleBase: 'posts' },
      }),
    )

    expect(config.locale.indexTitle).toBe('Posts')
  })



  test('resolveConfig_explicitIndexTitleOverridesDefault', () => {
    const config = expectOk(
      resolveConfig({
        collections: ['vault'],
        locale: { indexTitle: 'All Articles' },
      }),
    )

    expect(config.locale.indexTitle).toBe('All Articles')
  })



  test('resolveConfig_explicitTopicIndexTitleOverridesDefault', () => {
    const config = expectOk(
      resolveConfig({
        collections: ['vault'],
        locale: { topicIndexTitle: 'Categories' },
      }),
    )

    expect(config.locale.topicIndexTitle).toBe('Categories')
  })



  test('resolveConfig_emptyIndexTitleFallsBackToArticleBase', () => {
    const config = expectOk(
      resolveConfig({
        collections: ['vault'],
        locale: { indexTitle: '' },
      }),
    )

    expect(config.locale.indexTitle).toBe('Articles')
  })



  test('resolveConfig_browsePageSize_overridesPaginationPageSize', () => {
    const config = expectOk(
      resolveConfig({
        collections: ['vault'],
        pagination: { pageSize: 10 },
        browse: { pageSize: 30 },
      }),
    )

    expect(config.browse.pageSize).toBe(30)
    expect(config.pagination.pageSize).toBe(10)
  })



  test('resolveConfig_paginationPageSize_mapsToLegacyCompat', () => {
    const config = expectOk(
      resolveConfig({
        collections: ['vault'],
        pagination: { pageSize: 15 },
      }),
    )

    expect(config.browse.pageSize).toBe(15)
  })



  test('resolveConfig_jsonldEnabled_defaultsToTrue', () => {
    const config = expectOk(resolveConfig({ collections: ['vault'] }))

    expect(config.jsonld.enabled).toBe(true)
  })



  test('resolveConfig_jsonldEnabled_canBeDisabled', () => {
    const config = expectOk(
      resolveConfig({
        collections: ['vault'],
        jsonld: { enabled: false },
      }),
    )

    expect(config.jsonld.enabled).toBe(false)
  })
})

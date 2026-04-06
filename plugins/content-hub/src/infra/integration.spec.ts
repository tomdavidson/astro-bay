import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { InjectedRoute } from 'astro'
import type { EntryTransform } from '../types.ts'
import {
    contentHub,
    getTransforms,
    registerTransforms,
    resetTransformRegistry,
} from './integration.ts'
import { resetRegistry } from './registry.ts'

const noopTransform: EntryTransform = async (entry) => entry

type SetupContext = {
    readonly isRestart: boolean
    readonly command: string
    readonly updateConfig: (config: Record<string, unknown>) => void
    readonly injectRoute: (route: InjectedRoute) => void
    readonly logger: { readonly info: (msg: string) => void }
}

const makeSetupContext = (
    overrides?: Partial<SetupContext>,
): {
    readonly ctx: SetupContext
    readonly updateConfig: ReturnType<typeof vi.fn>
    readonly injectRoute: ReturnType<typeof vi.fn>
    readonly info: ReturnType<typeof vi.fn>
} => {
    const updateConfig = vi.fn()
    const injectRoute = vi.fn()
    const info = vi.fn()

    const ctx: SetupContext = {
        isRestart: false,
        command: 'build',
        updateConfig,
        injectRoute,
        logger: { info },
        ...overrides,
    }

    return { ctx, updateConfig, injectRoute, info }
}

const getHooks = (integration: ReturnType<typeof contentHub>) => integration.hooks

describe('transform registry', () => {
    beforeEach(() => {
        resetTransformRegistry()
    })

    test('getTransforms_unknownHub_returnsEmptyArray', () => {
        expect(getTransforms('missing')).toEqual([])
    })

    test('registerTransforms_thenGetTransforms_returnsRegisteredTransforms', () => {
        registerTransforms('writing', [noopTransform])

        expect(getTransforms('writing')).toEqual([noopTransform])
    })

    test('resetTransformRegistry_clearsRegisteredTransforms', () => {
        registerTransforms('writing', [noopTransform])

        resetTransformRegistry()

        expect(getTransforms('writing')).toEqual([])
    })
})

describe('contentHub', () => {
    beforeEach(() => {
        resetRegistry()
        resetTransformRegistry()
        vi.restoreAllMocks()
    })

    test('contentHub_setsExpectedIntegrationName', () => {
        const integration = contentHub({
            name: 'writing',
            collections: ['vault'],
        })

        expect(integration.name).toBe('astro-content-hub-writing')
    })

    test('astro:config:setup_injectsArticleIndexArticleTopicHubAndTopicIndexRoutes', async () => {
        const integration = contentHub({
            name: 'writing',
            collections: ['vault'],
            permalinks: { articleBase: 'articles' },
            taxonomy: { route: 'topics', indexPage: true },
        })

        const hooks = getHooks(integration)
        const { ctx, injectRoute, updateConfig, info } = makeSetupContext()

        await hooks['astro:config:setup']?.(ctx as never)

        expect(updateConfig).toHaveBeenCalledTimes(1)
        expect(injectRoute).toHaveBeenCalledTimes(4)

        expect(injectRoute).toHaveBeenNthCalledWith(1, {
            pattern: 'articles/[...page]',
            entrypoint: 'astro-content-hub/src/pages/ArticleIndex.astro',
            prerender: true,
        })
        expect(injectRoute).toHaveBeenNthCalledWith(2, {
            pattern: 'articles/[uid]',
            entrypoint: 'astro-content-hub/src/pages/Article.astro',
            prerender: true,
        })
        expect(injectRoute).toHaveBeenNthCalledWith(3, {
            pattern: 'topics',
            entrypoint: 'astro-content-hub/src/pages/TopicIndex.astro',
            prerender: true,
        })
        expect(injectRoute).toHaveBeenNthCalledWith(4, {
            pattern: 'topics/[topic]/[[...page]]',
            entrypoint: 'astro-content-hub/src/pages/TopicHub.astro',
            prerender: true,
        })
        expect(info).toHaveBeenCalledTimes(1)
    })

    test('astro:config:setup_skipsTopicIndexWhenDisabled', async () => {
        const integration = contentHub({
            name: 'writing',
            collections: ['vault'],
            taxonomy: { route: 'subjects', indexPage: false },
            permalinks: { articleBase: 'writing' },
        })

        const hooks = getHooks(integration)
        const { ctx, injectRoute } = makeSetupContext()

        await hooks['astro:config:setup']?.(ctx as never)

        expect(injectRoute).toHaveBeenCalledTimes(3)

        expect(injectRoute).toHaveBeenNthCalledWith(1, {
            pattern: 'writing/[...page]',
            entrypoint: 'astro-content-hub/src/pages/ArticleIndex.astro',
            prerender: true,
        })
        expect(injectRoute).toHaveBeenNthCalledWith(2, {
            pattern: 'writing/[uid]',
            entrypoint: 'astro-content-hub/src/pages/Article.astro',
            prerender: true,
        })
        expect(injectRoute).toHaveBeenNthCalledWith(3, {
            pattern: 'subjects/[topic]/[[...page]]',
            entrypoint: 'astro-content-hub/src/pages/TopicHub.astro',
            prerender: true,
        })
    })

    test('astro:config:setup_duplicateHubName_throws', async () => {
        const first = contentHub({
            name: 'shared',
            collections: ['vault'],
            permalinks: { articleBase: 'articles-a' },
            taxonomy: { route: 'topics-a' },
        })
        const second = contentHub({
            name: 'shared',
            collections: ['feed'],
            permalinks: { articleBase: 'articles-b' },
            taxonomy: { route: 'topics-b' },
        })

        const firstHooks = getHooks(first)
        const secondHooks = getHooks(second)

        await firstHooks['astro:config:setup']!(
            makeSetupContext({ isRestart: false }).ctx as never,
        )

        await expect(
            secondHooks['astro:config:setup']!(
                makeSetupContext({ isRestart: true }).ctx as never,
            ),
        ).rejects.toThrow('duplicate hub name')
    })

    test('astro:config:setup_duplicateArticleBase_throws', async () => {
        const first = contentHub({
            name: 'writing',
            collections: ['vault'],
            permalinks: { articleBase: 'articles' },
            taxonomy: { route: 'topics-a' },
        })
        const second = contentHub({
            name: 'notes',
            collections: ['feed'],
            permalinks: { articleBase: 'articles' },
            taxonomy: { route: 'topics-b' },
        })

        const firstHooks = getHooks(first)
        const secondHooks = getHooks(second)

        await firstHooks['astro:config:setup']!(
            makeSetupContext({ isRestart: false }).ctx as never,
        )

        await expect(
            secondHooks['astro:config:setup']!(
                makeSetupContext({ isRestart: true }).ctx as never,
            ),
        ).rejects.toThrow('permalinks.articleBase')
    })

    test('astro:config:setup_duplicateTaxonomyRoute_throws', async () => {
        const first = contentHub({
            name: 'writing',
            collections: ['vault'],
            permalinks: { articleBase: 'articles-a' },
            taxonomy: { route: 'topics' },
        })
        const second = contentHub({
            name: 'notes',
            collections: ['feed'],
            permalinks: { articleBase: 'articles-b' },
            taxonomy: { route: 'topics' },
        })

        const firstHooks = getHooks(first)
        const secondHooks = getHooks(second)

        await firstHooks['astro:config:setup']!(
            makeSetupContext({ isRestart: false }).ctx as never,
        )

        await expect(
            secondHooks['astro:config:setup']!(
                makeSetupContext({ isRestart: true }).ctx as never,
            ),
        ).rejects.toThrow('taxonomy.route')
    })

    test('astro:config:done_injectsTypes', () => {
        const integration = contentHub({
            name: 'writing',
            collections: ['vault'],
            transforms: [noopTransform],
        })

        const hooks = getHooks(integration)
        const injectTypes = vi.fn()

        hooks['astro:config:done']?.({
            config: { site: 'https://example.com' },
            injectTypes,
        } as never)

        expect(injectTypes).toHaveBeenCalledTimes(1)
        expect(injectTypes).toHaveBeenCalledWith(
            expect.objectContaining({
                filename: 'content-hub-writing.d.ts',
            }),
        )
    })

    test('astro:config:done_withoutSite_warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { })
        const integration = contentHub({
            name: 'writing',
            collections: ['vault'],
        })

        const hooks = getHooks(integration)
        const injectTypes = vi.fn()

        hooks['astro:config:done']?.({
            config: { site: undefined },
            injectTypes,
        } as never)

        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0]?.[0])).toContain('`site` not set in astro.config')
    })

    test('astro:build:done_logsBuildComplete', () => {
        const integration = contentHub({
            name: 'writing',
            collections: ['vault'],
        })

        const hooks = getHooks(integration)
        const info = vi.fn()

        hooks['astro:build:done']?.({ logger: { info } } as never)

        expect(info).toHaveBeenCalledTimes(1)
        expect(String(info.mock.calls[0]?.[0])).toContain('build complete')
    })

    test('contentHub_invalidConfig_throwsImmediately', () => {
        expect(() =>
            contentHub({
                name: 'broken',
                collections: [],
            }),
        ).toThrow('invalid configuration')
    })
})
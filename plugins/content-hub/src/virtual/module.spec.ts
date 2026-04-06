import { describe, expect, test } from 'vitest'
import type { ResolvedConfig } from '../config.ts'
import {
    buildVirtualModulePlugin,
    buildVirtualModuleTypes,
    virtualModuleId,
    virtualLayoutId,
} from './module.ts'

const cfg: ResolvedConfig = {
    name: 'default',
    collections: ['vault'],
    layout: '../Layout.astro',
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
    locale: { lang: 'en', dateLocale: 'en-US' },
    transforms: [],
    siteUrl: 'https://example.com',
}

describe('virtualModuleId', () => {
    test('virtualModuleId_default_baseColon', () => {
        expect(virtualModuleId('default')).toBe('astro-content-hub:config')
    })

    test('virtualModuleId_named_slashVariant', () => {
        expect(virtualModuleId('writing')).toBe('astro-content-hub/writing:config')
    })
})

describe('virtualLayoutId', () => {
    test('virtualLayoutId_default_baseColon', () => {
        expect(virtualLayoutId('default')).toBe('astro-content-hub:layout')
    })

    test('virtualLayoutId_named_slashVariant', () => {
        expect(virtualLayoutId('writing')).toBe('astro-content-hub/writing:layout')
    })
})

describe('buildVirtualModulePlugin resolveId', () => {
    const plugin = buildVirtualModulePlugin(cfg, 'build')

    test('plugin_matchesOwnId_resolves', () => {
        expect(plugin.resolveId?.('astro-content-hub:config')).toBe('\0astro-content-hub:config')
    })

    test('plugin_resolvesLayoutId', () => {
        expect(plugin.resolveId?.('astro-content-hub:layout')).toBe('\0astro-content-hub:layout')
    })

    test('plugin_foreignId_returnsUndefined', () => {
        expect(plugin.resolveId?.('astro:content')).toBeUndefined()
    })
})

describe('buildVirtualModulePlugin load', () => {
    const plugin = buildVirtualModulePlugin(cfg, 'build')

    test('plugin_load_returnsJsonConfig', () => {
        const src = plugin.load?.('\0astro-content-hub:config')
        expect(typeof src).toBe('string')
        if (typeof src !== 'string') return
        expect(src).toContain('export default')
        expect(src).toContain('vault')
    })

    test('plugin_load_withLayout_exportsUserLayoutAsDefault', () => {
        const layoutPlugin = buildVirtualModulePlugin({ ...cfg, layout: '../Layout.astro' }, 'build')

        expect(layoutPlugin.resolveId?.('astro-content-hub:layout')).toBe('\0astro-content-hub:layout')
        expect(layoutPlugin.load?.('\0astro-content-hub:layout')).toBe(
            "export { default } from '../Layout.astro'",
        )
    })

    test('plugin_load_noLayout_exportsNull', () => {
        const layoutPlugin = buildVirtualModulePlugin({ ...cfg, layout: undefined }, 'build')

        expect(layoutPlugin.resolveId?.('astro-content-hub:layout')).toBe('\0astro-content-hub:layout')
        expect(layoutPlugin.load?.('\0astro-content-hub:layout')).toBe('export default null')
    })

    test('plugin_load_noTransformsKey', () => {
        const src = plugin.load?.('\0astro-content-hub:config') ?? ''
        expect(src).not.toContain('transforms')
    })
})

describe('buildVirtualModuleTypes', () => {
    test('buildVirtualModuleTypes_default_declaresConfigAndLayoutModules', () => {
        const src = buildVirtualModuleTypes('default')

        expect(src).toContain("declare module 'astro-content-hub:config'")
        expect(src).toContain("declare module 'astro-content-hub:layout'")
        expect(src).toContain("import type { ResolvedConfig } from 'astro-content-hub/config'")
        expect(src).toContain(
            "const config: Omit<ResolvedConfig, 'transforms'> & { readonly astroCommand: string }",
        )
        expect(src).toContain('const Layout: unknown')
    })

    test('buildVirtualModuleTypes_named_declaresConfigAndLayoutModules', () => {
        const src = buildVirtualModuleTypes('writing')

        expect(src).toContain("declare module 'astro-content-hub/writing:config'")
        expect(src).toContain("declare module 'astro-content-hub/writing:layout'")
    })
})
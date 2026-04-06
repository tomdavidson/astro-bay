import type { AstroIntegration, InjectedRoute } from 'astro'
import type { EntryTransform } from '../types.ts'
import { resolveConfig, type PluginOptions, type ResolvedConfig } from '../config.ts'
import { claimHubName, claimRoutePrefix, resetRegistry } from './registry.ts'
import { buildVirtualModulePlugin, buildVirtualModuleTypes } from '../virtual/module.ts'



// --- Transform registry (additive-only, for external/test registration) ---
const transformRegistry = new Map<string, ReadonlyArray<EntryTransform>>()



export const getTransforms = (hubName: string): ReadonlyArray<EntryTransform> =>
  transformRegistry.get(hubName) ?? []



export const resetTransformRegistry = (): void => {
  transformRegistry.clear()
}



export const registerTransforms = (
  hubName: string,
  transforms: ReadonlyArray<EntryTransform>,
): void => {
  transformRegistry.set(hubName, transforms)
}



const throwDuplicateName = (name: string): never => {
  throw new Error(
    `astro-content-hub: duplicate hub name "${name}". Each contentHub() call must have a unique \`name\`.`,
  )
}



const throwDuplicateRoute = (route: string, hub: string, field: string): never => {
  throw new Error(
    `astro-content-hub: route prefix "${route}" already claimed by hub "${hub}". Use a unique \`${field}\`.`,
  )
}



const getRouteConfig = (partial: Omit<ResolvedConfig, 'siteUrl'>) => ({
  articleBase: partial.permalinks.articleBase,
  taxonomyRoute: partial.taxonomy.route,
})



const assertClaims = (partial: Omit<ResolvedConfig, 'siteUrl'>): void => {
  const nameResult = claimHubName(partial.name)
  if (!nameResult.ok) throwDuplicateName(partial.name)

  const { articleBase, taxonomyRoute } = getRouteConfig(partial)

  const articleClaim = claimRoutePrefix(articleBase, partial.name)
  if (!articleClaim.ok) {
    throwDuplicateRoute(articleBase, articleClaim.claimedBy, 'permalinks.articleBase')
  }

  const topicClaim = claimRoutePrefix(taxonomyRoute, partial.name)
  if (!topicClaim.ok) {
    throwDuplicateRoute(taxonomyRoute, topicClaim.claimedBy, 'taxonomy.route')
  }
}



const injectRoutes = (
  injectRoute: (route: InjectedRoute) => void,
  config: Omit<ResolvedConfig, 'siteUrl'>,
): void => {
  const { articleBase, taxonomyRoute } = getRouteConfig(config)

  injectRoute({
    pattern: `${articleBase}/[...page]`,
    entrypoint: 'astro-content-hub/src/pages/ArticleIndex.astro',
    prerender: true,
  })

  injectRoute({
    pattern: `${articleBase}/[uid]`,
    entrypoint: 'astro-content-hub/src/pages/Article.astro',
    prerender: true,
  })

  if (config.taxonomy.indexPage) {
    injectRoute({
      pattern: taxonomyRoute,
      entrypoint: 'astro-content-hub/src/pages/TopicIndex.astro',
      prerender: true,
    })
  }

  injectRoute({
    pattern: `${taxonomyRoute}/[topic]/[[...page]]`,
    entrypoint: 'astro-content-hub/src/pages/TopicHub.astro',
    prerender: true,
  })
}

type SetupContext = {
  readonly isRestart: boolean
  readonly command: string
  readonly updateConfig: (config: Record<string, unknown>) => void
  readonly injectRoute: (route: InjectedRoute) => void
  readonly logger: { readonly info: (msg: string) => void }
}



const handleSetup = async (
  ctx: SetupContext,
  partial: Omit<ResolvedConfig, 'siteUrl'>,
  resolvedFullConfig: ResolvedConfig,
): Promise<void> => {
  if (!ctx.isRestart) {
    resetRegistry()
    const { clearHubCache } = await import('./hub-data.ts')
    clearHubCache()
  }

  assertClaims(partial)

  ctx.updateConfig({
    vite: { plugins: [buildVirtualModulePlugin(resolvedFullConfig, ctx.command)] },
  })

  injectRoutes(ctx.injectRoute, partial)

  const { articleBase, taxonomyRoute } = getRouteConfig(partial)
  const indexLog = partial.taxonomy.indexPage ? `, ${taxonomyRoute}` : ''
  ctx.logger.info(
    `astro-content-hub [${partial.name}]: registered — ${articleBase}/[...page], ${articleBase}/[uid], ${taxonomyRoute}/[topic]/[[...page]]${indexLog}`,
  )
}



const handleConfigDone = (
  site: string | undefined,
  injectTypes: (args: { readonly filename: string; readonly content: string }) => void,
  partial: Omit<ResolvedConfig, 'siteUrl'>,
): ResolvedConfig => {
  const siteUrl = site ?? ''
  const resolvedFullConfig: ResolvedConfig = { ...partial, siteUrl }

  if (site === undefined) {
    console.warn(
      `astro-content-hub [${partial.name}]: \`site\` not set in astro.config — canonical URLs will be empty. Set \`site\` before deploying.`,
    )
  }

  injectTypes({
    filename: `content-hub-${partial.name}.d.ts`,
    content: buildVirtualModuleTypes(partial.name),
  })

  return resolvedFullConfig
}



const resolveOrThrow = (options: PluginOptions): Omit<ResolvedConfig, 'siteUrl'> => {
  const result = resolveConfig(options)
  if (result.isErr()) {
    const e = result.error
    throw new Error(
      `astro-content-hub: invalid configuration — ${e.type === 'ConfigInvalid' ? e.message : e.type}`,
    )
  }
  return result.value
}



export const contentHub = (options: PluginOptions): AstroIntegration => {
  const partial = resolveOrThrow(options)
  const state = { resolvedFullConfig: { ...partial, siteUrl: '' } satisfies ResolvedConfig }

  return {
    name: `astro-content-hub-${partial.name}`,
    hooks: {
      'astro:config:setup': async (ctx) => {
        await handleSetup(ctx, partial, state.resolvedFullConfig)
      },
      'astro:config:done': ({ config, injectTypes }) => {
        state.resolvedFullConfig = handleConfigDone(config.site, injectTypes, partial)
      },
      'astro:build:done': ({ logger }) => {
        logger.info(`astro-content-hub [${partial.name}]: build complete.`)
      },
    },
  }
}
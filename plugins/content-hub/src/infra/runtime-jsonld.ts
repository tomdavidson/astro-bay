import type { ResolvedConfig } from '../config.ts'
import { createContentHubProvider, createTopicsProvider } from '../jsonld-provider.ts'
import type { HubData, NormalizedEntry } from '../types.ts'
import { type GetCollection, getHubData as getHubDataInternal, type RuntimeContext } from './hub-data.ts'

export type RouteJsonLd = { readonly route: string; readonly node: Record<string, unknown> }

const buildRuntime = (command: string): RuntimeContext => ({
  logger: {
    warn: (msg: string): void => console.warn(msg),
    info: (msg: string): void => console.warn(`INFO: ${msg}`),
  },
  command,
})

const resolveHubData = async (
  config: ResolvedConfig,
  getCollection: GetCollection,
  command = 'build',
): Promise<HubData> => getHubDataInternal(config, getCollection, buildRuntime(command))

/**
 * Return JSON-LD route descriptors for all articles. This is the same data
 * shape produced by the content-hub JSON-LD provider, but accessible from
 * any Astro page or endpoint without holding the integration handle.
 */
export const getArticleJsonLdRoutes = async (
  config: ResolvedConfig,
  getCollection: GetCollection,
  command?: string,
): Promise<ReadonlyArray<RouteJsonLd>> => {
  const data = await resolveHubData(config, getCollection, command)
  const entries: ReadonlyArray<NormalizedEntry> = [...data.uidMap.values()]

  const provider = createContentHubProvider({
    site: config.siteUrl,
    articleBase: config.permalinks.articleBase,
    taxonomyRoute: config.taxonomy.route,
    entries,
  })

  return provider.provide() as Promise<ReadonlyArray<RouteJsonLd>>
}

/**
 * Return JSON-LD route descriptors for all topics, including the topic index
 * CollectionPage and one DefinedTerm per topic slug.
 */
export const getTopicJsonLdRoutes = async (
  config: ResolvedConfig,
  getCollection: GetCollection,
  command?: string,
): Promise<ReadonlyArray<RouteJsonLd>> => {
  const data = await resolveHubData(config, getCollection, command)

  const provider = createTopicsProvider({
    site: config.siteUrl,
    taxonomyRoute: config.taxonomy.route,
    topicMap: data.topicMap,
    groupedEntries: data.grouped,
  })

  return provider.provide() as Promise<ReadonlyArray<RouteJsonLd>>
}

import { err, ok, type Result } from 'neverthrow'
import type { EntryTransform, ContentHubError, DraftConfig } from './types.ts'



export type TaxonomyConfig = {
  readonly field: string
  readonly feedCategoryField: string
  readonly route: string
  readonly indexPage: boolean
}



export type PermalinksConfig = {
  readonly field: string
  readonly aliasField: string
  readonly articleBase: string
}



export type LocaleConfig = {
  readonly lang: string
  readonly dateLocale: string
  readonly indexTitle: string
  readonly topicIndexTitle: string
}



export type BrowseConfig = {
  readonly pageSize: number
  readonly staticFallbackCount: number
}



export type JsonLdConfig = {
  readonly enabled: boolean
}



export type PluginOptions = {
  readonly name?: string
  readonly collections: ReadonlyArray<string>
  readonly layout?: string
  readonly drafts?: DraftConfig
  readonly taxonomy?: Partial<TaxonomyConfig>
  readonly permalinks?: Partial<PermalinksConfig>
  /** @deprecated Use `browse.pageSize` instead. Will be removed in next major. */
  readonly pagination?: { readonly pageSize?: number }
  readonly browse?: Partial<BrowseConfig>
  readonly jsonld?: Partial<JsonLdConfig>
  readonly locale?: Partial<LocaleConfig>
  readonly transforms?: ReadonlyArray<EntryTransform>
}



export type ResolvedConfig = {
  readonly name: string
  readonly collections: ReadonlyArray<string>
  readonly layout: string | undefined
  readonly drafts: { readonly showInDev: boolean }
  readonly taxonomy: TaxonomyConfig
  readonly permalinks: PermalinksConfig
  readonly browse: BrowseConfig
  readonly jsonld: JsonLdConfig
  readonly locale: LocaleConfig
  readonly transforms: ReadonlyArray<EntryTransform>
  readonly siteUrl: string
}



const DEFAULT_PAGE_SIZE = 20



const DEFAULTS = {
  layout: undefined as string | undefined,
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
  browse: { pageSize: DEFAULT_PAGE_SIZE, staticFallbackCount: DEFAULT_PAGE_SIZE },
  locale: { lang: 'en', dateLocale: 'en-US', indexTitle: '', topicIndexTitle: 'Topics' },
} as const



const capitalize = (s: string): string =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)



const getBrowsePageSize = (opts: PluginOptions): number => {
  if (opts.browse?.pageSize !== undefined) return opts.browse.pageSize
  if (opts.pagination?.pageSize !== undefined) {
    console.warn(
      '[astro-content-hub] `pagination.pageSize` is deprecated. Use `browse.pageSize` instead.',
    )
    return opts.pagination.pageSize
  }
  return DEFAULTS.browse.pageSize
}



const getStaticFallbackCount = (opts: PluginOptions, browsePageSize: number): number => {
  if (opts.browse?.staticFallbackCount !== undefined) return opts.browse.staticFallbackCount
  return browsePageSize
}



const getJsonLdEnabled = (opts: PluginOptions): boolean => {
  if (opts.jsonld?.enabled !== undefined) return opts.jsonld.enabled
  return true
}



const getTaxonomyRoute = (opts: PluginOptions): string => {
  const t = opts.taxonomy
  if (t === undefined) return DEFAULTS.taxonomy.route
  const route = t.route
  if (route === undefined) return DEFAULTS.taxonomy.route
  return route
}



const getArticleBase = (opts: PluginOptions): string => {
  const p = opts.permalinks
  if (p === undefined) return DEFAULTS.permalinks.articleBase
  const base = p.articleBase
  if (base === undefined) return DEFAULTS.permalinks.articleBase
  return base
}



const getName = (opts: PluginOptions): string => {
  const name = opts.name
  if (name === undefined) return 'default'
  return name
}



const getTransforms = (opts: PluginOptions): ReadonlyArray<EntryTransform> => {
  const t = opts.transforms
  if (t === undefined) return []
  return t
}



const getLayout = (opts: PluginOptions): string | undefined => {
  const l = opts.layout
  if (l === undefined) return DEFAULTS.layout
  return l
}



const getIndexTitle = (opts: PluginOptions, articleBase: string): string => {
  const explicit = opts.locale?.indexTitle
  if (explicit !== undefined && explicit.length > 0) return explicit
  return capitalize(articleBase)
}



const getTopicIndexTitle = (opts: PluginOptions): string => {
  const explicit = opts.locale?.topicIndexTitle
  if (explicit !== undefined && explicit.length > 0) return explicit
  return DEFAULTS.locale.topicIndexTitle
}



const validateCollections = (
  collections: ReadonlyArray<string> | undefined,
): string | undefined => {
  if (collections === undefined) return '`collections` must be a non-empty array'
  if (collections.length === 0) return '`collections` must be a non-empty array'
  if (collections.some((c) => typeof c !== 'string')) return '`collections` entries must be non-empty strings'
  if (collections.some((c) => c.trim().length === 0)) return '`collections` entries must be non-empty strings'
  return undefined
}



const validatePageSize = (pageSize: number): string | undefined => {
  if (!Number.isInteger(pageSize)) return '`browse.pageSize` must be a positive integer'
  if (pageSize < 1) return '`browse.pageSize` must be a positive integer'
  return undefined
}



const validateRoutes = (taxRoute: string, permBase: string): string | undefined => {
  if (taxRoute.startsWith('/')) return '`taxonomy.route` must not have leading or trailing slashes'
  if (taxRoute.endsWith('/')) return '`taxonomy.route` must not have leading or trailing slashes'
  if (permBase.startsWith('/')) return '`permalinks.articleBase` must not have leading or trailing slashes'
  if (permBase.endsWith('/')) return '`permalinks.articleBase` must not have leading or trailing slashes'
  return undefined
}



const validateTransforms = (transforms: ReadonlyArray<unknown> | undefined): string | undefined => {
  if (transforms === undefined) return undefined
  if (transforms.some((t) => typeof t !== 'function')) return '`transforms` must be an array of functions'
  return undefined
}



const validateLayout = (layout: string | undefined): string | undefined => {
  if (layout === undefined) return undefined
  if (layout.trim().length === 0) return '`layout` must be a non-empty string'
  return undefined
}



const getFirstError = (
  opts: PluginOptions,
  taxRoute: string,
  artBase: string,
): string | undefined => {
  const e1 = validateCollections(opts.collections)
  if (e1 !== undefined) return e1

  const e2 = validateRoutes(taxRoute, artBase)
  if (e2 !== undefined) return e2

  const e3 = validateTransforms(opts.transforms)
  if (e3 !== undefined) return e3

  return validateLayout(opts.layout)
}



type ResolvedParts = {
  readonly opts: PluginOptions
  readonly taxRoute: string
  readonly artBase: string
  readonly browsePageSize: number
}

const buildResolvedConfig = (parts: ResolvedParts): Omit<ResolvedConfig, 'siteUrl'> => ({
  name: getName(parts.opts),
  collections: parts.opts.collections,
  layout: getLayout(parts.opts),
  drafts: { ...DEFAULTS.drafts, ...parts.opts.drafts },
  taxonomy: { ...DEFAULTS.taxonomy, ...parts.opts.taxonomy, route: parts.taxRoute },
  permalinks: { ...DEFAULTS.permalinks, ...parts.opts.permalinks, articleBase: parts.artBase },
  browse: {
    pageSize: parts.browsePageSize,
    staticFallbackCount: getStaticFallbackCount(parts.opts, parts.browsePageSize),
  },
  jsonld: { enabled: getJsonLdEnabled(parts.opts) },
  locale: {
    ...DEFAULTS.locale,
    ...parts.opts.locale,
    indexTitle: getIndexTitle(parts.opts, parts.artBase),
    topicIndexTitle: getTopicIndexTitle(parts.opts),
  },
  transforms: getTransforms(parts.opts),
})

export const resolveConfig = (
  opts: PluginOptions,
): Result<Omit<ResolvedConfig, 'siteUrl'>, ContentHubError> => {
  const taxRoute = getTaxonomyRoute(opts)
  const artBase = getArticleBase(opts)
  const browsePageSize = getBrowsePageSize(opts)

  const sizeError = validatePageSize(browsePageSize)
  if (sizeError !== undefined) return err({ type: 'ConfigInvalid', message: sizeError })

  const errorMsg = getFirstError(opts, taxRoute, artBase)
  if (errorMsg !== undefined) return err({ type: 'ConfigInvalid', message: errorMsg })

  return ok(buildResolvedConfig({ opts, taxRoute, artBase, browsePageSize }))
}

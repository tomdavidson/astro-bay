import type { ResolvedConfig } from '../config.ts'

const VIRTUAL_BASE = 'astro-content-hub'

export const virtualModuleId = (hubName: string): string =>
  hubName === 'default'
    ? `${VIRTUAL_BASE}:config`
    : `${VIRTUAL_BASE}/${hubName}:config`

export const virtualLayoutId = (hubName: string): string =>
  hubName === 'default'
    ? `${VIRTUAL_BASE}:layout`
    : `${VIRTUAL_BASE}/${hubName}:layout`

export const resolvedVirtualId = (hubName: string): string =>
  `\0${virtualModuleId(hubName)}`

export const resolvedLayoutId = (hubName: string): string =>
  `\0${virtualLayoutId(hubName)}`

const createPayload = (config: ResolvedConfig, command: string) => ({
  name: config.name,
  collections: config.collections,
  layout: config.layout,
  drafts: config.drafts,
  taxonomy: config.taxonomy,
  permalinks: config.permalinks,
  pagination: config.pagination,
  locale: config.locale,
  siteUrl: config.siteUrl,
  astroCommand: command,
})

type ResolverIds = {
  readonly id: string
  readonly rid: string
  readonly layoutId: string
  readonly rLayoutId: string
}

const createResolver =
  ({ id, rid, layoutId, rLayoutId }: ResolverIds) =>
  (moduleId: string): string | undefined => {
    if (moduleId === id) return rid
    if (moduleId === layoutId) return rLayoutId
    return undefined
  }

type LoaderConfig = {
  readonly rid: string
  readonly rLayoutId: string
  readonly payload: unknown
  readonly layout: string | undefined
}

const createLoader =
  ({ rid, rLayoutId, payload, layout }: LoaderConfig) =>
  (moduleId: string): string | undefined => {
    if (moduleId === rid) {
      return `export default ${JSON.stringify(payload)}`
    }

    if (moduleId !== rLayoutId) {
      return undefined
    }

    if (layout === undefined) {
      return `export default null`
    }

    return `export { default } from '${layout}'`
  }

export const buildVirtualModulePlugin = (config: ResolvedConfig, command: string) => {
  const id = virtualModuleId(config.name)
  const rid = resolvedVirtualId(config.name)
  const layoutId = virtualLayoutId(config.name)
  const rLayoutId = resolvedLayoutId(config.name)
  const payload = createPayload(config, command)

  return {
    name: `astro-content-hub-virtual-${config.name}`,
    resolveId: createResolver({ id, rid, layoutId, rLayoutId }),
    load: createLoader({ rid, rLayoutId, payload, layout: config.layout }),
  }
}

export const buildVirtualModuleTypes = (hubName: string): string =>
  `
declare module '${virtualModuleId(hubName)}' {
  import type { ResolvedConfig } from '@astro-bay/content-hub/config'
  const config: Omit<ResolvedConfig, 'transforms'> & { readonly astroCommand: string }
  export default config
}

declare module '${virtualLayoutId(hubName)}' {
  const Layout: any
  export default Layout
}
`.trim()
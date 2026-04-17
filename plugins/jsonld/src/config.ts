import type { JsonLdProvider, LdesConfig, TypeRegistration } from './types.ts'

export type JsonLdOptions = {
  readonly site?: string
  readonly context?: Record<string, string>
  readonly providers?: ReadonlyArray<JsonLdProvider>
  readonly typeRegistrations?: ReadonlyArray<TypeRegistration>
  readonly ldes?: Partial<LdesConfig>
  readonly validate?: boolean
}

export type ResolvedConfig = {
  readonly site: string
  readonly context: Record<string, string>
  readonly providers: ReadonlyArray<JsonLdProvider>
  readonly typeRegistrations: ReadonlyArray<TypeRegistration>
  readonly ldes: LdesConfig
  readonly validate: boolean
}

const DEFAULT_CONTEXT: Record<string, string> = {
  '@vocab': 'https://schema.org/',
  'skos': 'http://www.w3.org/2004/02/skos/core#',
  'ldp': 'http://www.w3.org/ns/ldp#',
  'ldes': 'https://w3id.org/ldes#',
  'tree': 'https://w3id.org/tree#',
} as const

const DEFAULT_LDES: LdesConfig = {
  enabled: true,
  path: '/changes.jsonld',
  stateFile: '.astro-jsonld-state.json',
} as const

const resolveSite = (fallbackSite: string, options?: JsonLdOptions): string => options?.site ?? fallbackSite

const resolveContext = (options?: JsonLdOptions): Record<string, string> => ({
  ...DEFAULT_CONTEXT,
  ...options?.context,
})

const resolveProviders = (options?: JsonLdOptions): ReadonlyArray<JsonLdProvider> => options?.providers ?? []

const resolveTypeRegistrations = (options?: JsonLdOptions): ReadonlyArray<TypeRegistration> =>
  options?.typeRegistrations ?? []

const resolveLdesConfig = (options?: JsonLdOptions): LdesConfig => ({ ...DEFAULT_LDES, ...options?.ldes })

const resolveValidate = (options?: JsonLdOptions): boolean => options?.validate ?? true

export const mergeConfig = (site: string, options?: JsonLdOptions): ResolvedConfig => ({
  site: resolveSite(site, options),
  context: resolveContext(options),
  providers: resolveProviders(options),
  typeRegistrations: resolveTypeRegistrations(options),
  ldes: resolveLdesConfig(options),
  validate: resolveValidate(options),
})

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

export const mergeConfig = (
  site: string,
  options?: JsonLdOptions,
): ResolvedConfig => ({
  site: options?.site ?? site,
  context: { ...DEFAULT_CONTEXT, ...options?.context },
  providers: options?.providers ?? [],
  typeRegistrations: options?.typeRegistrations ?? [],
  ldes: { ...DEFAULT_LDES, ...options?.ldes },
  validate: options?.validate ?? true,
})

// Option types, defaults, and merge. Pure.

export type TaxonomyOptions = {
  readonly providers?: ReadonlyArray<import('./types.ts').TaxonomyProvider>
  readonly virtualModule?: string
  readonly strict?: boolean
}

export type ResolvedConfig = {
  readonly providers: ReadonlyArray<import('./types.ts').TaxonomyProvider>
  readonly virtualModule: string
  readonly strict: boolean
}

const DEFAULTS: ResolvedConfig = { providers: [], virtualModule: 'astro-taxonomy:graph', strict: false }

export const mergeConfig = (options?: TaxonomyOptions): ResolvedConfig => ({
  providers: options?.providers ?? DEFAULTS.providers,
  virtualModule: options?.virtualModule ?? DEFAULTS.virtualModule,
  strict: options?.strict ?? DEFAULTS.strict,
})

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any

  describe('mergeConfig', () => {
    test('mergeConfig/noOptions/returnsDefaults', () => {
      const c = mergeConfig()
      expect(c.providers).toStrictEqual([])
      expect(c.virtualModule).toBe('astro-taxonomy:graph')
      expect(c.strict).toBe(false)
    })
    test('mergeConfig/partialOverride/mergesWithDefaults', () => {
      const c = mergeConfig({ strict: true })
      expect(c.strict).toBe(true)
      expect(c.virtualModule).toBe('astro-taxonomy:graph')
    })
    test('mergeConfig/customModule/usesSupplied', () => {
      const c = mergeConfig({ virtualModule: 'my-site:taxonomy' })
      expect(c.virtualModule).toBe('my-site:taxonomy')
    })
    test('mergeConfig/idempotent', () => {
      const opts: TaxonomyOptions = { strict: true, virtualModule: 'custom:graph' }
      expect(mergeConfig(opts)).toStrictEqual(mergeConfig(opts))
    })
    test('mergeConfig/fullOverride/noDefaultsLeakThrough', () => {
      const opts: TaxonomyOptions = { providers: [], virtualModule: 'x:y', strict: true }
      const c = mergeConfig(opts)
      expect(c.strict).toBe(true)
      expect(c.virtualModule).toBe('x:y')
    })
  })
}

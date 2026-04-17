// Config types, defaults, and merge function.

export type LogLevel = 'debug' | 'info' | 'silent'

export type Smart404Config = {
  readonly scoreThreshold: number
  readonly redirectDominanceFactor: number
  readonly maxSuggestions: number
  readonly stripBases: ReadonlyArray<string>
  readonly searchRoute: string
  readonly logLevel: LogLevel
  readonly urlPathWeight: number
  readonly minUrlPathScoreForRedirect: number
  /**
   * Path to the Pagefind JS entry point, loaded dynamically in the browser.
   * Defaults to the standard astro-pagefind output location.
   * Override if you have a non-standard site base or output directory.
   */
  readonly pagefindPath: string
}

export type Smart404Options = {
  readonly scoreThreshold?: number
  readonly redirectDominanceFactor?: number
  readonly maxSuggestions?: number
  readonly stripBases?: ReadonlyArray<string>
  readonly searchRoute?: string
  readonly logLevel?: LogLevel
  readonly urlPathWeight?: number
  readonly minUrlPathScoreForRedirect?: number
  readonly pagefindPath?: string
}

export const DEFAULTS: Smart404Config = {
  scoreThreshold: 0.55,
  redirectDominanceFactor: 1.15,
  maxSuggestions: 5,
  stripBases: [],
  searchRoute: '/search',
  logLevel: 'info',
  urlPathWeight: 0.9,
  minUrlPathScoreForRedirect: 0.45,
  pagefindPath: '/pagefind/pagefind.js',
}

/**
 * Merge caller-supplied options with defaults.
 * Every field in Smart404Config has a safe default; the result is always complete.
 */
export const mergeConfig = (options?: Smart404Options): Smart404Config => ({ ...DEFAULTS, ...options })

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any

  describe('mergeConfig', () => {
    test('mergeConfig_noOptions_returnsDefaults', () => {
      const c = mergeConfig()
      expect(c.scoreThreshold).toBe(0.55)
      expect(c.redirectDominanceFactor).toBe(1.25)
      expect(c.maxSuggestions).toBe(5)
      expect(c.stripBases).toStrictEqual([])
      expect(c.searchRoute).toBe('/search')
      expect(c.logLevel).toBe('info')
      expect(c.urlPathWeight).toBe(0.8)
      expect(c.minUrlPathScoreForRedirect).toBe(0.45)
      expect(c.pagefindPath).toBe('/pagefind/pagefind.js')
    })

    test('mergeConfig_partialOverride_mergesWithDefaults', () => {
      const c = mergeConfig({ scoreThreshold: 0.6, stripBases: ['articles'] })
      expect(c.scoreThreshold).toBe(0.6)
      expect(c.redirectDominanceFactor).toBe(1.25)
      expect(c.stripBases).toStrictEqual(['articles'])
      expect(c.pagefindPath).toBe('/pagefind/pagefind.js')
    })

    test('mergeConfig_pagefindPathOverride_usesSupplied', () => {
      const c = mergeConfig({ pagefindPath: '/assets/pagefind/pagefind.js' })
      expect(c.pagefindPath).toBe('/assets/pagefind/pagefind.js')
    })

    test('mergeConfig_idempotent', () => {
      const opts = { scoreThreshold: 0.5, searchRoute: '/find' }
      expect(mergeConfig(opts)).toStrictEqual(mergeConfig(opts))
    })

    test('mergeConfig_fullOverride_noDefaultsLeakThrough', () => {
      const opts: Smart404Options = {
        scoreThreshold: 0.7,
        redirectDominanceFactor: 2.0,
        maxSuggestions: 3,
        stripBases: ['blog'],
        searchRoute: '/find',
        logLevel: 'debug',
        urlPathWeight: 0.5,
        minUrlPathScoreForRedirect: 0.3,
        pagefindPath: '/custom/pagefind.js',
      }
      const c = mergeConfig(opts)
      expect(c).toStrictEqual({ ...opts })
    })
  })
}

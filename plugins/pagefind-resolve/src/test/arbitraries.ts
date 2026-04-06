import * as fc from 'fast-check'
import type { Smart404Config } from '../config.ts'
import { DEFAULTS } from '../config.ts'
import type { PagefindResult } from '../types.ts'

export const scoreArb = fc.float({ min: 0, max: 1, noNaN: true })

export const urlSlugArb = fc.array(
  fc.string({ minLength: 1, maxLength: 12 }).filter(s => /^[a-z0-9-]+$/.test(s)),
  { minLength: 1, maxLength: 3 },
).map(parts => `/articles/${parts.join('-')}`)

export const resultArb: fc.Arbitrary<PagefindResult> = fc.record({
  url: urlSlugArb,
  score: scoreArb,
  title: fc.string({ minLength: 1, maxLength: 60 }),
})

export const configArb: fc.Arbitrary<Smart404Config> = fc.record({
  scoreThreshold: scoreArb,
  redirectDominanceFactor: fc.float({ min: 1, max: 3, noNaN: true }),
  maxSuggestions: fc.integer({ min: 1, max: 20 }),
  stripBases: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  searchRoute: fc.constantFrom('/search', '/find', '/s'),
  logLevel: fc.constantFrom('debug' as const, 'info' as const, 'silent' as const),
  urlPathWeight: scoreArb,
  minUrlPathScoreForRedirect: scoreArb,
  pagefindPath: fc.constantFrom(DEFAULTS.pagefindPath, '/assets/pagefind/pagefind.js'),
})

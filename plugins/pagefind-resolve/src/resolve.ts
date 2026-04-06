// Resolution policy: given already-reweighted results, decide the outcome.
// Single responsibility: policy logic only.
// Tests here cover only the policy logic — not the math from url.ts or scoring.ts.

import { isConfidentRedirect } from './scoring'
import type { PagefindResult, ResolutionResult } from './types'
import { scoreUrlMatch, tokenizeQuery } from './url'

export type ResolveConfig = {
  readonly scoreThreshold: number
  readonly redirectDominanceFactor: number
  readonly maxSuggestions: number
  readonly minUrlPathScoreForRedirect: number
}

/**
 * Given reweighted Pagefind results, return redirect, suggestions, or no-results.
 *
 * Two gates must both pass for a redirect:
 *   1. Top score dominates (isConfidentRedirect)
 *   2. Top result URL resembles the query (URL-path gate)
 *
 * The URL-path gate prevents body-content matches from stealing automatic redirects.
 */
export const resolveResults = (
  results: ReadonlyArray<PagefindResult>,
  query: string,
  config: ResolveConfig,
): ResolutionResult => {
  const top = results[0]
  if (top === undefined) return { status: 'no-results' }

  const scores = results.map(r => r.score)
  const queryTokens = tokenizeQuery(query)
  const isRedirect = isConfidentRedirect(scores, config.scoreThreshold, config.redirectDominanceFactor) &&
    scoreUrlMatch(queryTokens, top.url) >= config.minUrlPathScoreForRedirect

  return isRedirect ?
    { status: 'redirect', url: top.url, score: top.score, title: top.title } :
    { status: 'suggestions', results: results.slice(0, config.maxSuggestions) }
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any
  const t: any = test
  const tdd = !!import.meta.env?.TDD

  const cfg: ResolveConfig = {
    scoreThreshold: 0.55,
    redirectDominanceFactor: 1.25,
    maxSuggestions: 5,
    minUrlPathScoreForRedirect: 0.45,
  }

  const r = (url: string, score: number, title = 'Test'): PagefindResult => ({ url, score, title })

  describe('resolveResults', () => {
    test('resolveResults_empty_noResults', () => {
      expect(resolveResults([], '', cfg).status).toBe('no-results')
    })

    test('resolveResults_dominantUrlMatch_redirects', () => {
      const out = resolveResults([r('/about', 0.9), r('/contact', 0.3)], 'about', cfg)
      expect(out.status).toBe('redirect')
      if (out.status === 'redirect') {
        expect(out.url).toBe('/about')
        expect(out.title).toBe('Test')
      }
    })

    test('resolveResults_dominantButUrlMismatch_suggestions', () => {
      const out = resolveResults([r('/contact', 0.9), r('/about', 0.3)], 'about', cfg)
      expect(out.status).toBe('suggestions')
    })

    test('resolveResults_ambiguousScores_suggestions', () => {
      const out = resolveResults([r('/about', 0.8), r('/contact', 0.75)], 'about', cfg)
      expect(out.status).toBe('suggestions')
    })

    test('resolveResults_belowThreshold_suggestions', () => {
      const out = resolveResults([r('/about', 0.3)], 'about', cfg)
      expect(out.status).toBe('suggestions')
    })

    test('resolveResults_suggestions_cappedAtMax', () => {
      const results = Array.from({ length: 10 }, (_, i) => r(`/${i}`, 0.8 - i * 0.005))
      const out = resolveResults(results, 'query', { ...cfg, maxSuggestions: 3 })
      if (out.status === 'suggestions') expect(out.results).toHaveLength(3)
    })

    test('resolveResults_singleResult_aboveThresholdUrlMatch_redirects', () => {
      const out = resolveResults([r('/about', 0.9)], 'about', cfg)
      expect(out.status).toBe('redirect')
    })

    t.skipIf(tdd)('resolveResults_neverExceedsMaxSuggestions', async () => {
      const { default: fc } = await import('fast-check')
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              url: fc.constantFrom('/a', '/b', '/c', '/d'),
              score: fc.float({ min: 0, max: 1, noNaN: true }),
              title: fc.constant('T'),
            }),
            { minLength: 0, maxLength: 20 },
          ),
          fc.integer({ min: 1, max: 10 }),
          (results: PagefindResult[], max: number) => {
            const out = resolveResults(results, 'q', { ...cfg, maxSuggestions: max })
            return out.status !== 'suggestions' || out.results.length <= max
          },
        ),
      )
    })

    t.skipIf(tdd)('resolveResults_empty_alwaysNoResults', async () => {
      const { default: fc } = await import('fast-check')
      fc.assert(
        fc.property(
          fc.string(),
          fc.record({
            scoreThreshold: fc.float({ min: 0, max: 1, noNaN: true }),
            redirectDominanceFactor: fc.float({ min: 1, max: 3, noNaN: true }),
            maxSuggestions: fc.integer({ min: 1, max: 10 }),
            minUrlPathScoreForRedirect: fc.float({ min: 0, max: 1, noNaN: true }),
          }),
          (query: string, config: ResolveConfig) => resolveResults([], query, config).status === 'no-results',
        ),
      )
    })

    t.skipIf(tdd)('resolveResults_statusIsAlwaysOneOfThree', async () => {
      const { default: fc } = await import('fast-check')
      const resultArb = fc.record({
        url: fc.constantFrom('/about', '/contact', '/blog', '/work'),
        score: fc.float({ min: 0, max: 1, noNaN: true }),
        title: fc.constant('T'),
      })
      fc.assert(
        fc.property(
          fc.array(resultArb, { minLength: 0, maxLength: 10 }),
          fc.string(),
          (results: PagefindResult[], query: string) => {
            const out = resolveResults(results, query, cfg)
            return ['redirect', 'suggestions', 'no-results'].includes(out.status)
          },
        ),
      )
    })
  })
}

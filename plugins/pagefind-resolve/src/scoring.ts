// Result scoring: reweighting and redirect confidence.
// Imports url.ts — Layer 2 integration behavior, but tests here cover only
// the logic defined in this file, not url.ts internals.

import type { PagefindResult } from './types'
import { scoreUrlMatch, tokenizeQuery } from './url'

/**
 * Blend Pagefind content score with URL-path match score, then re-sort descending.
 * urlPathWeight=0.8 → 80% URL similarity, 20% content relevance.
 */
export const reweightResults = (
  results: ReadonlyArray<PagefindResult>,
  query: string,
  urlPathWeight: number,
): ReadonlyArray<PagefindResult> => {
  const queryTokens = tokenizeQuery(query)
  const contentWeight = 1 - urlPathWeight
  return [...results].map(r => ({
    ...r,
    score: urlPathWeight * scoreUrlMatch(queryTokens, r.url) + contentWeight * r.score,
  })).sort((a, b) => b.score - a.score)
}

/**
 * True when the top score exceeds the threshold AND dominates
 * the second result by at least the given factor.
 */
export const isConfidentRedirect = (
  scores: ReadonlyArray<number>,
  threshold: number,
  redirectDominanceFactor: number,
): boolean => {
  const top = scores[0]
  if (top === undefined || top < threshold) return false
  const second = scores[1]
  if (second === undefined || second === 0) return true
  return top / second >= redirectDominanceFactor
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any
  const t: any = test
  const tdd = !!import.meta.env?.TDD

  describe('isConfidentRedirect', () => {
    test('isConfidentRedirect_empty_false', () => {
      expect(isConfidentRedirect([], 0.55, 1.25)).toBe(false)
    })
    test('isConfidentRedirect_singleAboveThreshold_true', () => {
      expect(isConfidentRedirect([0.9], 0.55, 1.25)).toBe(true)
    })
    test('isConfidentRedirect_singleBelowThreshold_false', () => {
      expect(isConfidentRedirect([0.4], 0.55, 1.25)).toBe(false)
    })
    test('isConfidentRedirect_exactlyAtThreshold_true', () => {
      expect(isConfidentRedirect([0.55], 0.55, 1.25)).toBe(true)
    })
    test('isConfidentRedirect_topDominatesSecond_true', () => {
      expect(isConfidentRedirect([0.9, 0.4], 0.55, 1.25)).toBe(true)
    })
    test('isConfidentRedirect_tooCloseToSecond_false', () => {
      expect(isConfidentRedirect([0.8, 0.75], 0.55, 1.25)).toBe(false)
    })
    test('isConfidentRedirect_secondIsZero_true', () => {
      expect(isConfidentRedirect([0.6, 0], 0.55, 1.25)).toBe(true)
    })

    t.skipIf(tdd)('isConfidentRedirect_belowThreshold_alwaysFalse', async () => {
      const { default: fc } = await import('fast-check')
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 0, max: Math.fround(0.54), noNaN: true }), { minLength: 1 }),
          (scores: number[]) => !isConfidentRedirect(scores, 0.55, 1.25),
        ),
      )
    })

    t.skipIf(tdd)('isConfidentRedirect_singleAboveThreshold_alwaysTrue', async () => {
      const { default: fc } = await import('fast-check')
      fc.assert(
        fc.property(fc.float({ min: Math.fround(0.55), max: 1, noNaN: true }), (score: number) =>
          isConfidentRedirect([score], 0.55, 1.25)),
      )
    })
  })

  describe('reweightResults', () => {
    const r = (url: string, score: number): PagefindResult => ({ url, score, title: 'T' })

    test('reweightResults_highUrlMatch_rankedFirst', () => {
      const results = [r('/contact', 0.9), r('/our-work', 0.5)]
      expect(reweightResults(results, 'work', 0.8)[0]?.url).toBe('/our-work')
    })
    test('reweightResults_zeroUrlWeight_preservesContentOrder', () => {
      const results = [r('/contact', 0.9), r('/our-work', 0.5)]
      expect(reweightResults(results, 'work', 0)[0]?.url).toBe('/contact')
    })
    test('reweightResults_empty_returnsEmpty', () => {
      expect(reweightResults([], 'query', 0.8)).toStrictEqual([])
    })
    test('reweightResults_preservesResultCount', () => {
      const results = [r('/a', 0.9), r('/b', 0.5), r('/c', 0.3)]
      expect(reweightResults(results, 'query', 0.8)).toHaveLength(3)
    })
    test('reweightResults_doesNotMutateInput', () => {
      const results = [r('/a', 0.9), r('/b', 0.5)]
      const copy = [...results]
      reweightResults(results, 'query', 0.8)
      expect(results).toStrictEqual(copy)
    })

    t.skipIf(tdd)('reweightResults_countAlwaysPreserved', async () => {
      const { default: fc } = await import('fast-check')
      const resultArb = fc.record({
        url: fc.constantFrom('/a', '/b', '/about', '/contact'),
        score: fc.float({ min: 0, max: 1, noNaN: true }),
        title: fc.constant('T'),
      })
      fc.assert(
        fc.property(
          fc.array(resultArb, { minLength: 0, maxLength: 10 }),
          fc.string(),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (results: PagefindResult[], query: string, weight: number) =>
            reweightResults(results, query, weight).length === results.length,
        ),
      )
    })

    t.skipIf(tdd)('reweightResults_sortedDescending', async () => {
      const { default: fc } = await import('fast-check')
      const resultArb = fc.record({
        url: fc.constantFrom('/a', '/b', '/about', '/contact'),
        score: fc.float({ min: 0, max: 1, noNaN: true }),
        title: fc.constant('T'),
      })
      fc.assert(
        fc.property(
          fc.array(resultArb, { minLength: 2, maxLength: 10 }),
          fc.string(),
          fc.float({ min: 0, max: 1, noNaN: true }),
          (results: PagefindResult[], query: string, weight: number) => {
            const reweighted = reweightResults(results, query, weight)
            for (let i = 1; i < reweighted.length; i++) {
              if ((reweighted[i - 1]?.score ?? 0) < (reweighted[i]?.score ?? 0)) return false
            }
            return true
          },
        ),
      )
    })
  })
}

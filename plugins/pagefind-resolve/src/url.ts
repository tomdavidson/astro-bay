// URL tokenization and path-match scoring.
// No imports from this package. Tests only cover functions defined here.

const HALF_CREDIT = 0.5

export const tokenizePath = (path: unknown): ReadonlyArray<string> => {
  if (typeof path !== 'string') return []
  return path.replace(/^\/|\/$/g, '').split(/[-_/]/).map(s => s.toLowerCase().trim()).filter(s =>
    s.length > 0
  )
}

export const tokenizeQuery = (query: unknown): ReadonlyArray<string> => {
  if (typeof query !== 'string') return []
  return query.toLowerCase().split(/\s+/).filter(s => s.length > 0)
}

const tokenCredit = (qt: string, urlTokens: ReadonlyArray<string>): number => {
  if (urlTokens.some(ut => ut === qt)) return 1
  if (urlTokens.some(ut => ut.includes(qt) || qt.includes(ut))) return HALF_CREDIT
  return 0
}

/**
 * Score how well query tokens match a URL path (0–1).
 * "work" vs "/our-work"   → 1.0  (exact)
 * "about us" vs "/about"  → 0.5  (1 of 2 tokens)
 * "work" vs "/contact"    → 0.0  (no overlap)
 */
export const scoreUrlMatch = (queryTokens: ReadonlyArray<string>, resultUrl: unknown): number => {
  if (queryTokens.length === 0) return 0
  const urlTokens = tokenizePath(resultUrl)
  if (urlTokens.length === 0) return 0
  const matched = queryTokens.reduce((sum, qt) => sum + tokenCredit(qt, urlTokens), 0)
  return Math.min(matched / queryTokens.length, 1)
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any
  const t: any = test
  const tdd = !!import.meta.env?.TDD

  describe('tokenizePath', () => {
    test('tokenizePath_dashSeparated_splits', () => {
      expect(tokenizePath('/our-work')).toStrictEqual(['our', 'work'])
    })
    test('tokenizePath_slashSeparated_splits', () => {
      expect(tokenizePath('/a/b/c')).toStrictEqual(['a', 'b', 'c'])
    })
    test('tokenizePath_trailingSlash_ignored', () => {
      expect(tokenizePath('/about/')).toStrictEqual(['about'])
    })
    test('tokenizePath_root_returnsEmpty', () => {
      expect(tokenizePath('/')).toStrictEqual([])
    })
    test('tokenizePath_nonString_returnsEmpty', () => {
      expect(tokenizePath(undefined)).toStrictEqual([])
      expect(tokenizePath(42)).toStrictEqual([])
    })
  })

  describe('tokenizeQuery', () => {
    test('tokenizeQuery_spaceSeparated_splits', () => {
      expect(tokenizeQuery('about us')).toStrictEqual(['about', 'us'])
    })
    test('tokenizeQuery_uppercase_lowercased', () => {
      expect(tokenizeQuery('About Us')).toStrictEqual(['about', 'us'])
    })
    test('tokenizeQuery_extraWhitespace_collapsed', () => {
      expect(tokenizeQuery('  about  us  ')).toStrictEqual(['about', 'us'])
    })
    test('tokenizeQuery_empty_returnsEmpty', () => {
      expect(tokenizeQuery('')).toStrictEqual([])
    })
    test('tokenizeQuery_nonString_returnsEmpty', () => {
      expect(tokenizeQuery(undefined)).toStrictEqual([])
    })
  })

  describe('scoreUrlMatch', () => {
    test('scoreUrlMatch_exactToken_returns1', () => {
      expect(scoreUrlMatch(['work'], '/our-work')).toBe(1)
    })
    test('scoreUrlMatch_noOverlap_returns0', () => {
      expect(scoreUrlMatch(['work'], '/contact')).toBe(0)
    })
    test('scoreUrlMatch_oneOfTwoTokensMatch_returnsHalf', () => {
      expect(scoreUrlMatch(['about', 'us'], '/about')).toBe(HALF_CREDIT)
    })
    test('scoreUrlMatch_substringMatch_returnsHalfCredit', () => {
      expect(scoreUrlMatch(['work'], '/working-groups')).toBe(HALF_CREDIT)
    })
    test('scoreUrlMatch_emptyTokens_returns0', () => {
      expect(scoreUrlMatch([], '/about')).toBe(0)
    })
    test('scoreUrlMatch_nonStringUrl_returns0', () => {
      expect(scoreUrlMatch(['about'], undefined)).toBe(0)
    })

    t.skipIf(tdd)('scoreUrlMatch_alwaysBetween0And1', async () => {
      const { default: fc } = await import('fast-check')
      const tokenArb = fc.array(
        fc.string({ minLength: 1, maxLength: 8 }).filter((s: string) => /^[a-z]+$/.test(s)),
        { minLength: 1, maxLength: 4 },
      )
      fc.assert(
        fc.property(
          tokenArb,
          fc.constantFrom('/about', '/contact', '/our-work', '/get-involved', '/'),
          (tokens: string[], url: string) => {
            const s = scoreUrlMatch(tokens, url)
            return s >= 0 && s <= 1
          },
        ),
      )
    })

    t.skipIf(tdd)('scoreUrlMatch_neverExceeds1', async () => {
      const { default: fc } = await import('fast-check')
      const pathArb = fc.string({ minLength: 1, maxLength: 30 })
      const tokensArb = fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 6 })
      fc.assert(
        fc.property(tokensArb, pathArb, (tokens: string[], url: string) => scoreUrlMatch(tokens, url) <= 1),
      )
    })
  })
}

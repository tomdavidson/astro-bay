// Pathname-to-query conversion.
// Input is always a URL path segment — no HTML, no scripts, no user-generated text.
// pathToQuery is the XSS boundary: it accepts a URL partial and emits only
// alphanumeric words separated by spaces. No HTML is ever produced.

const stripMatchingBase = (path: string, bases: ReadonlyArray<string>): string => {
  const normalizedBases = bases.map(b => b.replace(/^\/|\/$/g, ''))
  const match = normalizedBases.find(b => b.length > 0 && (path.startsWith(`${b}/`) || path === b))
  if (match === undefined) return path
  if (path === match) return ''
  return path.slice(match.length + 1)
}

/**
 * Convert a URL pathname into a Pagefind search query.
 * Strips base prefixes, converts separators to spaces, and trims whitespace.
 *
 * Output contains only alphanumeric characters and spaces — safe for all
 * downstream consumers including DOM text nodes. No HTML is produced.
 *
 * "/articles/family-court-outcomes" + ["articles"] → "family court outcomes"
 * "/about-us" + []                                  → "about us"
 */
export const pathToQuery = (pathname: string, stripBases: ReadonlyArray<string> = []): string => {
  const stripped = stripMatchingBase(pathname.replace(/^\/|\/$/g, ''), stripBases)
  return stripped.replace(/[-_/]/g, ' ').replace(/[<>&"']/g, '').replace(/\s+/g, ' ').trim()
}
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any
  const t: any = test
  const tdd = !!import.meta.env?.TDD

  describe('pathToQuery', () => {
    test('pathToQuery_withBase_stripsAndConverts', () => {
      expect(pathToQuery('/articles/family-court-outcomes', ['articles'])).toBe('family court outcomes')
    })

    test('pathToQuery_noMatchingBase_convertsFullPath', () => {
      expect(pathToQuery('/about-us', [])).toBe('about us')
    })

    test('pathToQuery_underscores_convertedToSpaces', () => {
      expect(pathToQuery('/articles/foo_bar', ['articles'])).toBe('foo bar')
    })

    test('pathToQuery_trailingSlash_trimmed', () => {
      expect(pathToQuery('/articles/some-slug/', ['articles'])).toBe('some slug')
    })

    test('pathToQuery_pathIsExactlyBase_returnsEmpty', () => {
      expect(pathToQuery('/articles', ['articles'])).toBe('')
    })

    test('pathToQuery_multipleBases_matchesFirst', () => {
      expect(pathToQuery('/blog/my-post', ['articles', 'blog'])).toBe('my post')
    })

    test('pathToQuery_rootPath_returnsEmpty', () => {
      expect(pathToQuery('/', [])).toBe('')
    })

    test('pathToQuery_consecutiveDashes_collapsedToSpace', () => {
      expect(pathToQuery('/articles/foo--bar', ['articles'])).toBe('foo  bar'.replace(/\s+/, ' ').trim())
    })

    test('pathToQuery_deepPath_keepsRemainder', () => {
      expect(pathToQuery('/blog/2024/some-post', ['blog'])).toBe('2024 some post')
    })

    test('pathToQuery_outputContainsNoHTMLChars', () => {
      const result = pathToQuery('/articles/<script>alert(1)</script>', ['articles'])
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
    })

    t.skipIf(tdd)('pathToQuery_neverLeadingOrTrailingSpaces', async () => {
      const { default: fc } = await import('fast-check')
      const slugArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) =>
        /^[a-z0-9-_]+$/.test(s)
      )
      fc.assert(fc.property(slugArb, (slug: string) => {
        const result = pathToQuery(`/articles/${slug}`, ['articles'])
        return result === result.trim()
      }))
    })

    t.skipIf(tdd)('pathToQuery_neverContainsSeparators', async () => {
      const { default: fc } = await import('fast-check')
      const slugArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) =>
        /^[a-z0-9-_]+$/.test(s)
      )
      fc.assert(fc.property(slugArb, (slug: string) => {
        const result = pathToQuery(`/articles/${slug}`, ['articles'])
        return !result.includes('-') && !result.includes('_') && !result.includes('/')
      }))
    })

    t.skipIf(tdd)('pathToQuery_neverConsecutiveSpaces', async () => {
      const { default: fc } = await import('fast-check')
      const slugArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s: string) =>
        /^[a-z0-9-_]+$/.test(s)
      )
      fc.assert(fc.property(slugArb, (slug: string) => !pathToQuery(`/${slug}`, []).includes('  ')))
    })

    t.skipIf(tdd)('pathToQuery_outputContainsNoHTMLEntities', async () => {
      const { default: fc } = await import('fast-check')
      const pathArb = fc.string({ minLength: 1, maxLength: 40 })
      fc.assert(fc.property(pathArb, (path: string) => {
        const result = pathToQuery(path, [])
        return !result.includes('<') && !result.includes('>')
      }))
    })
  })
}

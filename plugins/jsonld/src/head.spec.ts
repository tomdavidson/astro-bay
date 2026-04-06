import { describe, expect, test } from 'vitest'
import { buildAlternateLink } from './head.domain.ts'

describe('buildAlternateLink', () => {
  test('buildAlternateLink|trailingSlash|includesIndexJsonld', () => {
    expect(buildAlternateLink('/articles/test/'))
      .toBe('<link rel="alternate" type="application/ld+json" href="/articles/test/index.jsonld">')
  })

  test('buildAlternateLink|noTrailingSlash|appendsSlashAndFilename', () => {
    expect(buildAlternateLink('/articles/test'))
      .toBe('<link rel="alternate" type="application/ld+json" href="/articles/test/index.jsonld">')
  })
})

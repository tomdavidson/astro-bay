import { describe, expect, test } from 'vitest'
import { wrapAsContainer } from './container.domain.ts'

describe('wrapAsContainer', () => {
  test('wrapAsContainer|emptyMembers|producesValidContainer', () => {
    const result = JSON.parse(
      wrapAsContainer('https://example.com/articles/', [], { '@vocab': 'https://schema.org/' }),
    ) as Record<string, unknown>
    expect(result['@type']).toStrictEqual(['CollectionPage', 'ldp:BasicContainer'])
    expect(result['@id']).toBe('https://example.com/articles/')
    expect(result['ldp:contains']).toStrictEqual([])
  })

  test('wrapAsContainer|withMembers|ldpContainsIdRefs', () => {
    const members = [
      { '@type': 'BlogPosting', '@id': 'https://example.com/articles/a/' },
      { '@type': 'BlogPosting', '@id': 'https://example.com/articles/b/' },
    ] as const
    const result = JSON.parse(
      wrapAsContainer('https://example.com/articles/', members, {}),
    ) as Record<string, unknown>
    const ldpContains = result['ldp:contains'] as ReadonlyArray<{ readonly '@id': string }>
    expect(ldpContains).toHaveLength(2)
    expect(ldpContains[0]?.['@id']).toBe('https://example.com/articles/a/')
  })

  test('wrapAsContainer|withMembers|hasPartIsFullNodes', () => {
    const members = [
      { '@type': 'BlogPosting', '@id': 'https://example.com/articles/a/', 'headline': 'A' },
    ] as const
    const result = JSON.parse(
      wrapAsContainer('https://example.com/articles/', members, {}),
    ) as Record<string, unknown>
    const hasPart = result['hasPart'] as ReadonlyArray<Record<string, unknown>>
    expect(hasPart[0]?.['headline']).toBe('A')
  })

  test('wrapAsContainer|includesContextInOutput', () => {
    const ctx = { '@vocab': 'https://schema.org/', 'ldp': 'http://www.w3.org/ns/ldp#' }
    const result = JSON.parse(
      wrapAsContainer('https://example.com/articles/', [], ctx),
    ) as Record<string, unknown>
    expect(result['@context']).toStrictEqual(ctx)
  })
})

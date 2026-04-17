import { describe, expect, test } from 'vitest'
import { buildTypeRegistration } from './test/builders.ts'
import { buildTypeIndex } from './type-index.domain.ts'

describe('buildTypeIndex', () => {
  test('buildTypeIndex|singleRegistration|producesWebSite', () => {
    const result = JSON.parse(
      buildTypeIndex('https://example.com', { '@vocab': 'https://schema.org/' }, [buildTypeRegistration()]),
    ) as Record<string, unknown>
    expect(result['@type']).toBe('WebSite')
    expect(result['@id']).toBe('https://example.com/')
    const hasPart = result['hasPart'] as ReadonlyArray<Record<string, unknown>>
    expect(hasPart).toHaveLength(1)
    expect(hasPart[0]?.['solid:forClass']).toBe('https://schema.org/BlogPosting')
    expect(hasPart[0]?.['solid:instanceContainer']).toBe('https://example.com/articles/')
  })

  test('buildTypeIndex|emptyRegistrations|hasPartIsEmpty', () => {
    const result = JSON.parse(buildTypeIndex('https://example.com', {}, [])) as Record<string, unknown>
    expect(result['hasPart']).toStrictEqual([])
  })

  test('buildTypeIndex|includesSolidContext', () => {
    const result = JSON.parse(buildTypeIndex('https://example.com', {}, [])) as Record<string, unknown>
    const ctx = result['@context'] as Record<string, string>
    expect(ctx['solid']).toBe('http://www.w3.org/ns/solid/terms#')
  })

  test('buildTypeIndex|multipleRegistrations|allPresentInHasPart', () => {
    const result = JSON.parse(
      buildTypeIndex('https://example.com', {}, [
        buildTypeRegistration(),
        buildTypeRegistration({
          rdfType: 'http://www.w3.org/2004/02/skos/core#Concept',
          containerPath: '/topics/',
          label: 'Topics',
        }),
      ]),
    ) as Record<string, unknown>
    const hasPart = result['hasPart'] as ReadonlyArray<unknown>
    expect(hasPart).toHaveLength(2)
  })
})

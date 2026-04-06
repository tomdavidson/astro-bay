import { describe, expect, test } from 'vitest'
import { serializeAll, serializeNode } from './serializer.domain.ts'
import { buildRouteJsonLd } from './test/builders.ts'

describe('serializeNode', () => {
  test('serializeNode|minimalNode|includesContextAndId', () => {
    const input = buildRouteJsonLd({ route: '/articles/test/' })
    const result = serializeNode({ '@vocab': 'https://schema.org/' }, input)
    const parsed = JSON.parse(result.content) as Record<string, unknown>
    expect(parsed['@context']).toStrictEqual({ '@vocab': 'https://schema.org/' })
    expect(parsed['@id']).toBe('https://example.com/articles/test/')
  })

  test('serializeNode|withMembers|includesHasPart', () => {
    const input = buildRouteJsonLd({
      route: '/articles/',
      members: [buildRouteJsonLd().node],
    })
    const result = serializeNode({ '@vocab': 'https://schema.org/' }, input)
    const parsed = JSON.parse(result.content) as Record<string, unknown>
    expect(parsed['hasPart']).toHaveLength(1)
  })

  test('serializeNode|noMembers|omitsHasPart', () => {
    const input = buildRouteJsonLd({ route: '/articles/test/' })
    const result = serializeNode({ '@vocab': 'https://schema.org/' }, input)
    const parsed = JSON.parse(result.content) as Record<string, unknown>
    expect(parsed['hasPart']).toBeUndefined()
  })

  test('serializeNode|trailingSlash|filenameIsIndexJsonld', () => {
    const input = buildRouteJsonLd({ route: '/articles/test/' })
    const result = serializeNode({ '@vocab': 'https://schema.org/' }, input)
    expect(result.filename).toBe('/articles/test/index.jsonld')
  })

  test('serializeNode|noTrailingSlash|addsSlashBeforeFilename', () => {
    const input = buildRouteJsonLd({ route: '/articles/test' })
    const result = serializeNode({ '@vocab': 'https://schema.org/' }, input)
    expect(result.filename).toBe('/articles/test/index.jsonld')
  })
})

describe('serializeAll', () => {
  test('serializeAll|multipleRoutes|serializesEach', () => {
    const routes = [
      buildRouteJsonLd({ route: '/a/' }),
      buildRouteJsonLd({ route: '/b/' }),
    ]
    const result = serializeAll({ '@vocab': 'https://schema.org/' }, routes)
    expect(result).toHaveLength(2)
  })

  test('serializeAll|emptyRoutes|returnsEmpty', () => {
    const result = serializeAll({ '@vocab': 'https://schema.org/' }, [])
    expect(result).toHaveLength(0)
  })
})

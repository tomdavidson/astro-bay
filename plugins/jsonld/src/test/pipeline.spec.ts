import { describe, expect, test } from 'vitest'
import { buildState, diffState } from '../ldes.domain.ts'
import { serializeAll } from '../serializer.domain.ts'
import { buildTypeIndex } from '../type-index.domain.ts'
import { buildRouteJsonLd, buildTypeRegistration } from './builders.ts'
import { expectOk } from './helpers.ts'
import { validateAll } from '../validation.domain.ts'

describe('jsonld pipeline', () => {
  test('pipeline|validRoutes|serializesAndProducesTypeIndex', () => {
    const routes = [
      buildRouteJsonLd({ route: '/articles/a/', node: { '@type': 'BlogPosting', '@id': 'https://example.com/articles/a/' } }),
      buildRouteJsonLd({ route: '/articles/b/', node: { '@type': 'BlogPosting', '@id': 'https://example.com/articles/b/' } }),
    ]
    const context = { '@vocab': 'https://schema.org/' }

    const validated = expectOk(validateAll(routes))
    const serialized = serializeAll(context, validated)
    expect(serialized).toHaveLength(2)

    const typeIndex = buildTypeIndex(
      'https://example.com',
      context,
      [buildTypeRegistration()],
    )
    const parsed = JSON.parse(typeIndex) as Record<string, unknown>
    expect(parsed['@type']).toBe('WebSite')
    const hasPart = parsed['hasPart'] as ReadonlyArray<unknown>
    expect(hasPart).toHaveLength(1)
  })

  test('pipeline|addedRoute|ldesDetectsCreate', () => {
    const initial = [buildRouteJsonLd({ route: '/articles/a/', node: { '@type': 'BlogPosting', '@id': 'https://example.com/articles/a/' } })]
    const updated = [
      ...initial,
      buildRouteJsonLd({ route: '/articles/b/', node: { '@type': 'BlogPosting', '@id': 'https://example.com/articles/b/' } }),
    ]

    const prev = buildState(initial)
    const curr = buildState(updated)
    const changes = diffState(prev, curr, '2026-01-01T00:00:00Z')

    expect(changes).toHaveLength(1)
    expect(changes[0]?.type).toBe('Create')
    expect(changes[0]?.objectId).toBe('/articles/b/')
  })

  test('pipeline|removedRoute|ldesDetectsDelete', () => {
    const initial = [
      buildRouteJsonLd({ route: '/articles/a/', node: { '@type': 'BlogPosting', '@id': 'https://example.com/articles/a/' } }),
      buildRouteJsonLd({ route: '/articles/b/', node: { '@type': 'BlogPosting', '@id': 'https://example.com/articles/b/' } }),
    ]
    const updated = [initial[0]!]

    const prev = buildState(initial)
    const curr = buildState(updated)
    const changes = diffState(prev, curr, '2026-01-01T00:00:00Z')

    expect(changes).toHaveLength(1)
    expect(changes[0]?.type).toBe('Delete')
  })

  test('pipeline|invalidNodes|validationReturnsAllErrors', () => {
    const routes = [
      { route: '/a/', node: { '@type': 'BlogPosting', '@id': '' } },
      { route: '/b/', node: { '@type': 'BlogPosting', '@id': '' } },
    ]
    const result = validateAll(routes)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.length).toBe(2)
    }
  })
})

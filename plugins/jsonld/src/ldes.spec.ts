import { describe, test, expect } from 'vitest'
import { buildState, diffState, parseState, serializeState } from './ldes.domain.ts'
import { buildRouteJsonLd } from './test/builders.ts'
import { expectOk } from './test/helpers.ts'

const tdd = Boolean(import.meta.env?.['TDD'])

describe('buildState', () => {
  test('buildState|sameInput|deterministicHash', () => {
    const routes = [buildRouteJsonLd({ route: '/a/' })]
    const s1 = buildState(routes)
    const s2 = buildState(routes)
    expect(s1.get('/a/')).toBe(s2.get('/a/'))
  })

  test('buildState|differentContent|differentHash', () => {
    const r1 = buildRouteJsonLd({ route: '/a/', node: { '@type': 'BlogPosting', '@id': 'https://example.com/a/', 'headline': 'One' } })
    const r2 = buildRouteJsonLd({ route: '/a/', node: { '@type': 'BlogPosting', '@id': 'https://example.com/a/', 'headline': 'Two' } })
    const s1 = buildState([r1])
    const s2 = buildState([r2])
    expect(s1.get('/a/')).not.toBe(s2.get('/a/'))
  })
})

describe('diffState', () => {
  test('diffState|newRoute|emitsCreate', () => {
    const previous: ReadonlyMap<string, string> = new Map()
    const current = buildState([buildRouteJsonLd({ route: '/a/' })])
    const result = diffState(previous, current, '2026-01-01T00:00:00Z')
    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('Create')
    expect(result[0]?.objectId).toBe('/a/')
  })

  test('diffState|removedRoute|emitsDelete', () => {
    const previous = buildState([buildRouteJsonLd({ route: '/a/' })])
    const current: ReadonlyMap<string, string> = new Map()
    const result = diffState(previous, current, '2026-01-01T00:00:00Z')
    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('Delete')
  })

  test('diffState|unchangedRoute|emitsNothing', () => {
    const routes = [buildRouteJsonLd({ route: '/a/' })]
    const state = buildState(routes)
    const result = diffState(state, state, '2026-01-01T00:00:00Z')
    expect(result).toHaveLength(0)
  })

  test('diffState|modifiedRoute|emitsUpdate', () => {
    const prev = buildState([buildRouteJsonLd({
      route: '/a/',
      node: { '@type': 'BlogPosting', '@id': 'https://example.com/a/', 'headline': 'Old' },
    })])
    const curr = buildState([buildRouteJsonLd({
      route: '/a/',
      node: { '@type': 'BlogPosting', '@id': 'https://example.com/a/', 'headline': 'New' },
    })])
    const result = diffState(prev, curr, '2026-01-01T00:00:00Z')
    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('Update')
  })
})

describe('serializeState / parseState', () => {
  test('parseState|validJson|returnsMap', () => {
    const state: ReadonlyMap<string, string> = new Map([
      ['/a/', 'abc123'],
      ['/b/', 'def456'],
    ])
    const serialized = serializeState(state)
    const parsed = expectOk(parseState(serialized))
    expect(parsed.get('/a/')).toBe('abc123')
    expect(parsed.size).toBe(2)
  })

  test('parseState|invalidJson|returnsLdesStateCorruptError', () => {
    const result = parseState('not valid json {{{')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().type).toBe('LdesStateCorrupt')
  })
})

test.skipIf(tdd)('diffState|roundtrip|serializeParseIdentity', async () => {
  const fc = await import('fast-check')
  fc.assert(
    fc.property(
      fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 10 }),
      (routeNames: ReadonlyArray<string>) => {
        const routes = routeNames.map(name => buildRouteJsonLd({ route: `/${name}/` }))
        const state = buildState(routes)
        const serialized = serializeState(state)
        const parsed = expectOk(parseState(serialized))
        return parsed.size === state.size
      },
    ),
  )
})

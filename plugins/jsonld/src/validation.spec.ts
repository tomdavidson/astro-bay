import { describe, expect, test } from 'vitest'
import { validateAll } from './validation.domain.ts'

describe('validateAll', () => {
  test('validateAll|validRoutes|returnsOk', () => {
    const routes = [
      {
        route: '/a/',
        node: { '@type': 'BlogPosting', '@id': 'https://example.com/a/' },
      },
    ]
    const result = validateAll(routes)
    expect(result.isOk()).toBe(true)
  })

  test('validateAll|missingId|returnsMissingId', () => {
    const routes = [
      { route: '/a/', node: { '@type': 'BlogPosting', '@id': '' } },
    ]
    const result = validateAll(routes)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error[0]?.type).toBe('MissingId')
    }
  })

  test('validateAll|missingType|returnsInvalidNode', () => {
    const routes = [
      { route: '/a/', node: { '@id': 'https://example.com/a/' } as any },
    ]
    const result = validateAll(routes)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error[0]?.type).toBe('InvalidNode')
    }
  })

  test('validateAll|duplicateRoute|returnsDuplicateRoute', () => {
    const node = { '@type': 'BlogPosting', '@id': 'https://example.com/a/' }
    const routes = [
      { route: '/a/', node },
      { route: '/a/', node },
    ]
    const result = validateAll(routes)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.some(e => e.type === 'DuplicateRoute')).toBe(true)
    }
  })

  test('validateAll|emptyRoutes|returnsOk', () => {
    const result = validateAll([])
    expect(result.isOk()).toBe(true)
  })

  test('validateAll|reportsAllErrorsNotJustFirst', () => {
    const routes = [
      { route: '/a/', node: { '@type': 'BlogPosting', '@id': '' } },
      { route: '/b/', node: { '@type': 'BlogPosting', '@id': '' } },
    ]
    const result = validateAll(routes)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.length).toBeGreaterThanOrEqual(2)
    }
  })
})

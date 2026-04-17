import { describe, expect, test } from 'vitest'
import { buildRouteJsonLd } from './test/builders.ts'
import { expectErr, expectOk } from './test/helpers.ts'
import { validateAll } from './validation.domain.ts'

describe('validateAll', () => {
  test('validateAll|validRoutes|returnsOk', () => {
    const routes = [buildRouteJsonLd()]
    expectOk(validateAll(routes))
  })

  test('validateAll|missingId|returnsMissingId', () => {
    const routes = [buildRouteJsonLd({ node: { '@type': 'BlogPosting', '@id': '' } })]
    const errors = expectErr(validateAll(routes))
    expect(errors[0]?.type).toBe('MissingId')
  })

  test('validateAll|missingType|returnsInvalidNode', () => {
    const routes = [buildRouteJsonLd({ node: { '@id': 'https://example.com/a/' } as never })]
    const errors = expectErr(validateAll(routes))
    expect(errors[0]?.type).toBe('InvalidNode')
  })

  test('validateAll|duplicateRoute|returnsDuplicateRoute', () => {
    const routes = [buildRouteJsonLd({ route: '/a/' }), buildRouteJsonLd({ route: '/a/' })]
    const errors = expectErr(validateAll(routes))
    expect(errors.some(e => e.type === 'DuplicateRoute')).toBe(true)
  })

  test('validateAll|emptyRoutes|returnsOk', () => {
    expectOk(validateAll([]))
  })

  test('validateAll|reportsAllErrorsNotJustFirst', () => {
    const routes = [
      buildRouteJsonLd({ node: { '@type': 'BlogPosting', '@id': '' } }),
      buildRouteJsonLd({ route: '/b/', node: { '@type': 'BlogPosting', '@id': '' } }),
    ]
    const errors = expectErr(validateAll(routes))
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })
})

import type { Arbitrary } from 'fast-check'
import type * as FastCheck from 'fast-check'
import type { RouteJsonLd, TypeRegistration } from '../types.ts'

export const routeJsonLdArbitrary = async (): Promise<Arbitrary<RouteJsonLd>> => {
  const fc: typeof FastCheck = await import('fast-check')

  return fc.record({
    route: fc.string({ minLength: 1, maxLength: 20 }).map(value => `/${value}/`),
    node: fc.record({
      '@type': fc.string({ minLength: 1, maxLength: 20 }),
      '@id': fc.webUrl(),
      headline: fc.string({ minLength: 1, maxLength: 50 }),
    }) as unknown as Arbitrary<RouteJsonLd['node']>,
  }) as unknown as Arbitrary<RouteJsonLd>
}

export const typeRegistrationArbitrary = async (): Promise<Arbitrary<TypeRegistration>> => {
  const fc: typeof FastCheck = await import('fast-check')

  return fc.record({
    rdfType: fc.webUrl(),
    containerPath: fc.string({ minLength: 1, maxLength: 20 }).map(value => `/${value}/`),
    label: fc.string({ minLength: 1, maxLength: 30 }),
  }) as unknown as Arbitrary<TypeRegistration>
}

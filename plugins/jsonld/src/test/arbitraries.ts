import type { RouteJsonLd, TypeRegistration } from '../types.ts'

export const routeJsonLdArbitrary = async () => {
  const fc = await import('fast-check')
  return fc.record({
    route: fc.string({ minLength: 1, maxLength: 30 }).map(s => `/${s}/`),
    node: fc.record({
      '@type': fc.constantFrom('BlogPosting', 'Article', 'DefinedTerm', 'CollectionPage'),
      '@id': fc.webUrl(),
    }),
  }) as unknown as fc.Arbitrary<RouteJsonLd>
}

export const typeRegistrationArbitrary = async () => {
  const fc = await import('fast-check')
  return fc.record({
    rdfType: fc.webUrl(),
    containerPath: fc.string({ minLength: 1, maxLength: 20 }).map(s => `/${s}/`),
    label: fc.string({ minLength: 1, maxLength: 30 }),
  }) as unknown as fc.Arbitrary<TypeRegistration>
}

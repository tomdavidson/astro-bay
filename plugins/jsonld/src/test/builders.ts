import type { JsonLdNode, RouteJsonLd, TypeRegistration } from '../types.ts'

const buildNode = (overrides?: Partial<JsonLdNode>): JsonLdNode => ({
  '@type': 'BlogPosting',
  '@id': 'https://example.com/articles/test/',
  'headline': 'Test Article',
  ...overrides,
})

export const buildRouteJsonLd = (
  overrides?: Partial<RouteJsonLd>,
): RouteJsonLd => ({
  route: '/articles/test/',
  node: buildNode(overrides?.node !== undefined ? (overrides.node as Partial<JsonLdNode>) : undefined),
  ...overrides,
})

export const buildTypeRegistration = (
  overrides?: Partial<TypeRegistration>,
): TypeRegistration => ({
  rdfType: 'https://schema.org/BlogPosting',
  containerPath: '/articles/',
  label: 'Articles',
  ...overrides,
})

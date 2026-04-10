import type { RouteJsonLd } from './types.ts'

export type SerializedJsonLd = {
  readonly route: string
  readonly filename: string
  readonly content: string
}

const JSON_INDENT = Number.parseInt('2', 10)

const resolveFilename = (route: string): string => {
  const normalized = route.endsWith('/') ? route : `${route}/`
  return `${normalized}index.jsonld`
}

const buildDocument = (
  context: Record<string, string>,
  routeJsonLd: RouteJsonLd,
): Record<string, unknown> => ({
  '@context': context,
  ...routeJsonLd.node,
  ...(routeJsonLd.members === undefined ? {} : { hasPart: routeJsonLd.members }),
})

export const serializeNode = (
  context: Record<string, string>,
  routeJsonLd: RouteJsonLd,
): SerializedJsonLd => ({
  route: routeJsonLd.route,
  filename: resolveFilename(routeJsonLd.route),
  content: JSON.stringify(buildDocument(context, routeJsonLd), undefined, JSON_INDENT),
})

export const serializeAll = (
  context: Record<string, string>,
  routes: ReadonlyArray<RouteJsonLd>,
): ReadonlyArray<SerializedJsonLd> =>
  routes.map(r => serializeNode(context, r))

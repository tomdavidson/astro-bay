import { err, ok, type Result } from 'neverthrow'
import type { JsonLdError, RouteJsonLd } from './types.ts'

const validateNode = (r: RouteJsonLd): Result<RouteJsonLd, JsonLdError> => {
  if (r.node['@id'] === undefined || r.node['@id'] === '') {
    return err({ type: 'MissingId', route: r.route })
  }
  if (r.node['@type'] === undefined) {
    return err({ type: 'InvalidNode', route: r.route, reason: 'Missing @type' })
  }
  return ok(r)
}

const detectDuplicateRoutes = (routes: ReadonlyArray<RouteJsonLd>): ReadonlyArray<JsonLdError> => {
  const seen = new Set(routes.map(r => r.route).filter((route, index, all) => all.indexOf(route) !== index))

  return [...seen].map(route => ({ type: 'DuplicateRoute' as const, route, providers: [] }))
}

const collectNodeErrors = (routes: ReadonlyArray<RouteJsonLd>): ReadonlyArray<JsonLdError> =>
  routes.map(validateNode).flatMap(result => (result.isErr() ? [result.error] : []))

export const validateAll = (
  routes: ReadonlyArray<RouteJsonLd>,
): Result<ReadonlyArray<RouteJsonLd>, ReadonlyArray<JsonLdError>> => {
  const nodeErrors = collectNodeErrors(routes)
  const duplicateErrors = detectDuplicateRoutes(routes)
  const allErrors: ReadonlyArray<JsonLdError> = [...nodeErrors, ...duplicateErrors]

  return allErrors.length > 0 ? err(allErrors) : ok(routes)
}

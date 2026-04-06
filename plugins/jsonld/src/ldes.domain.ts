import { Result } from 'neverthrow'
import type { LdesMember, RouteJsonLd } from './types.ts'

export type LdesState = ReadonlyMap<string, string>

const hashContent = (content: string): string => {
  const hash = [...content].reduce(
    (h, ch) => ((Math.imul(31, h) + ch.charCodeAt(0)) | 0),
    0,
  )
  return (hash >>> 0).toString(36)
}

export const buildState = (
  routes: ReadonlyArray<RouteJsonLd>,
): LdesState =>
  new Map(
    routes.map(r => [r.route, hashContent(JSON.stringify(r.node))]),
  )

const detectCreates = (
  previous: LdesState,
  current: LdesState,
  timestamp: string,
): ReadonlyArray<LdesMember> =>
  [...current.entries()]
    .filter(([route]) => !previous.has(route))
    .map(([route]) => ({ type: 'Create' as const, objectId: route, timestamp }))

const detectUpdates = (
  previous: LdesState,
  current: LdesState,
  timestamp: string,
): ReadonlyArray<LdesMember> =>
  [...current.entries()]
    .filter(([route, hash]) => {
      const prev = previous.get(route)
      return prev !== undefined && prev !== hash
    })
    .map(([route]) => ({ type: 'Update' as const, objectId: route, timestamp }))

const detectDeletes = (
  previous: LdesState,
  current: LdesState,
  timestamp: string,
): ReadonlyArray<LdesMember> =>
  [...previous.keys()]
    .filter(route => !current.has(route))
    .map(route => ({ type: 'Delete' as const, objectId: route, timestamp }))

export const diffState = (
  previous: LdesState,
  current: LdesState,
  timestamp: string,
): ReadonlyArray<LdesMember> => [
  ...detectCreates(previous, current, timestamp),
  ...detectUpdates(previous, current, timestamp),
  ...detectDeletes(previous, current, timestamp),
]

export const serializeChangeFeed = (
  site: string,
  context: Record<string, string>,
  members: ReadonlyArray<LdesMember>,
): string =>
  JSON.stringify(
    {
      '@context': {
        ...context,
        'as': 'https://www.w3.org/ns/activitystreams#',
      },
      '@type': 'ldes:EventStream',
      '@id': `${site}/changes.jsonld`,
      'tree:member': members.map(m => ({
        '@type': `as:${m.type}`,
        'as:object': { '@id': `${site}${m.objectId}` },
        'as:published': m.timestamp,
      })),
    },
    null,
    2,
  )

export const serializeState = (state: LdesState): string =>
  JSON.stringify(Object.fromEntries(state), null, 2)

export const parseState = (
  raw: string,
): Result<LdesState, { readonly type: 'LdesStateCorrupt'; readonly path: string }> => {
  const parsed = Result.fromThrowable(
    () => JSON.parse(raw) as Record<string, string>,
    () => ({ type: 'LdesStateCorrupt' as const, path: '' }),
  )()

  return parsed.map(obj => new Map(Object.entries(obj)))
}

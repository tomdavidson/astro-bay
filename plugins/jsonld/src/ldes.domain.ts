import { err, ok, Result } from 'neverthrow'
import type { LdesMember, RouteJsonLd } from './types.ts'

export type LdesState = ReadonlyMap<string, string>

type LdesParseError = { readonly type: 'LdesStateCorrupt'; readonly path: string }

const HASH_PRIME = Number.parseInt('31', 10)
const RADIX = Number.parseInt('36', 10)
const INDENT = Number.parseInt('2', 10)

const hashContent = (content: string): string => {
  const hash = content.length === 0
    ? 0
    : Array.from({ length: content.length }).reduce(
        (accumulator: number, _unused: unknown, index: number) =>
          Math.imul(HASH_PRIME, accumulator) + content.charCodeAt(index),
        0,
      )

  return Math.abs(hash).toString(RADIX)
}

export const buildState = (
  routes: ReadonlyArray<RouteJsonLd>,
): LdesState =>
  new Map(
    routes.map(route => [route.route, hashContent(JSON.stringify(route.node))] as const),
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
      const previousHash = previous.get(route)
      return previousHash !== undefined && previousHash !== hash
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
        as: 'https://www.w3.org/ns/activitystreams#',
      },
      '@type': 'ldes:EventStream',
      '@id': `${site}/changes.jsonld`,
      'tree:member': members.map(member => ({
        '@type': `as:${member.type}`,
        'as:object': { '@id': `${site}${member.objectId}` },
        'as:published': member.timestamp,
      })),
    },
    undefined,
    INDENT,
  )

export const serializeState = (state: LdesState): string =>
  JSON.stringify(Object.fromEntries(state), undefined, INDENT)

const objectEntries = (value: object): ReadonlyArray<readonly [string, unknown]> =>
  Object.entries(value).map(([key, entryValue]) => [key, entryValue] as const)

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  objectEntries(value).every(([key, entryValue]) =>
    typeof key === 'string' && typeof entryValue === 'string',
  )

const parseUnknownJson = (
  raw: string,
): Result<unknown, LdesParseError> =>
  Result.fromThrowable(
    () => JSON.parse(raw) as unknown,
    () => ({ type: 'LdesStateCorrupt' as const, path: '' }),
  )()

const parseRecord = (
  raw: string,
): Result<Record<string, string>, LdesParseError> =>
  parseUnknownJson(raw).andThen(parsed =>
    isStringRecord(parsed)
      ? ok<Record<string, string>, LdesParseError>(parsed)
      : err({
          type: 'LdesStateCorrupt' as const,
          path: '',
        }),
  )

export const parseState = (
  raw: string,
): Result<LdesState, LdesParseError> =>
  parseRecord(raw).map(record => new Map(Object.entries(record)))

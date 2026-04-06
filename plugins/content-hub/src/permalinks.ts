import { err, ok, type Result } from 'neverthrow'
import type { AliasRoute, ContentHubError, NormalizedEntry } from './types.ts'

type CollisionRecord<T> = {
  readonly key: string
  readonly owners: ReadonlyArray<T>
}

type CollisionTracker<T> = {
  readonly seen: ReadonlyMap<string, T>
  readonly collisions: ReadonlyArray<CollisionRecord<T>>
}

type SourceKind = NormalizedEntry['source']

const createTracker = <T>(): CollisionTracker<T> => ({
  seen: new Map<string, T>(),
  collisions: [],
})

const recordOrCollide = <T>(
  tracker: CollisionTracker<T>,
  key: string,
  value: T,
): CollisionTracker<T> => {
  const existing = tracker.seen.get(key)

  if (existing === undefined) {
    return {
      ...tracker,
      seen: new Map([...tracker.seen, [key, value]]),
    }
  }

  const existingCollision = tracker.collisions.find(collision => collision.key === key)

  return existingCollision === undefined
    ? {
      ...tracker,
      collisions: [...tracker.collisions, { key, owners: [existing, value] }],
    }
    : {
      ...tracker,
      collisions: tracker.collisions.map(collision =>
        collision.key === key
          ? { ...collision, owners: [...collision.owners, value] }
          : collision,
      ),
    }
}

export const me = (
  uid: string,
  source: SourceKind,
  aliases: ReadonlyArray<string> = [],
): NormalizedEntry => ({
  uid,
  sourceId: uid,
  collectionName: 'c',
  title: uid,
  topics: [],
  aliases,
  date: undefined,
  draft: false,
  excerpt: undefined,
  source,
  link: undefined,
  meta: {},
})

export const detectCollisions = (
  entries: ReadonlyArray<NormalizedEntry>,
): Result<
  ReadonlyMap<string, NormalizedEntry>,
  Extract<ContentHubError, { readonly type: 'UidCollision' }>
> => {
  const tracker = entries.reduce(
    (acc, entry) => recordOrCollide(acc, entry.uid, entry.source),
    createTracker<string>(),
  )

  return tracker.collisions.length > 0
    ? err({
      type: 'UidCollision',
      collisions: tracker.collisions.map(collision => ({
        uid: collision.key,
        sources: collision.owners,
      })),
    })
    : ok(new Map(entries.map(entry => [entry.uid, entry])))
}

export const collectAliasRoutes = (
  entries: ReadonlyArray<NormalizedEntry>,
): Result<ReadonlyArray<AliasRoute>, ContentHubError> => {
  const tracker = entries.reduce(
    (acc, entry) =>
      entry.aliases.reduce(
        (inner, alias) => recordOrCollide(inner, alias, entry.uid),
        acc,
      ),
    createTracker<string>(),
  )

  return tracker.collisions.length > 0
    ? err({
      type: 'AliasCollision',
      collisions: tracker.collisions.map(collision => ({
        alias: collision.key,
        owners: collision.owners,
      })),
    })
    : ok(
      entries.flatMap(entry =>
        entry.aliases.map(alias => ({ alias, uid: entry.uid })),
      ),
    )
}
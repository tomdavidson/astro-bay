import { describe, expect, test } from 'vitest'
import type { ContentHubError } from './types.ts'
import { collectAliasRoutes, detectCollisions, me } from './permalinks.ts'
import { isTddEnabled } from '../test/helpers.ts'

const tdd = isTddEnabled()

const expectUidCollision = (
  error: ContentHubError,
): Extract<ContentHubError, { readonly type: 'UidCollision' }> => {
  expect(error.type).toBe('UidCollision')
  if (error.type !== 'UidCollision') {
    throw new Error('Expected UidCollision')
  }
  return error
}

const expectAliasCollision = (
  error: ContentHubError,
): Extract<ContentHubError, { readonly type: 'AliasCollision' }> => {
  expect(error.type).toBe('AliasCollision')
  if (error.type !== 'AliasCollision') {
    throw new Error('Expected AliasCollision')
  }
  return error
}

describe('detectCollisions', () => {
  test('detectCollisions:uniqueUids:returnsOkMap', () => {
    expect(detectCollisions([me('a', 'vault'), me('b', 'feed')]).isOk()).toBe(true)
  })

  test('detectCollisions:duplicateUid:returnsErrWithBothSources', () => {
    const result = detectCollisions([me('a', 'vault'), me('a', 'feed')])

    expect(result.isErr()).toBe(true)

    const error = expectUidCollision(result._unsafeUnwrapErr())
    expect(error.collisions).toHaveLength(1)
    expect(error.collisions[0]!.uid).toBe('a')
    expect(error.collisions[0]!.sources).toContain('vault')
    expect(error.collisions[0]!.sources).toContain('feed')
  })

  test('detectCollisions:multipleCollisions:reportsAll', () => {
    const result = detectCollisions([
      me('x', 'vault'),
      me('x', 'feed'),
      me('y', 'vault'),
      me('y', 'custom'),
    ])

    expect(result.isErr()).toBe(true)

    const error = expectUidCollision(result._unsafeUnwrapErr())
    expect(error.collisions).toHaveLength(2)

    const uids = error.collisions.map((collision) => collision.uid)
    expect(uids).toContain('x')
    expect(uids).toContain('y')
  })

  test('detectCollisions:empty:returnsOkEmptyMap', () => {
    expect(detectCollisions([])._unsafeUnwrap().size).toBe(0)
  })

  test.skipIf(tdd)('detectCollisions:uniqueUids:alwaysOk', async () => {
    const fc = await import('fast-check')
    const uidArb = fc.string({ minLength: 1, maxLength: 10 })

    fc.assert(
      fc.property(
        fc.uniqueArray(uidArb, { minLength: 0, maxLength: 20 }),
        (uids: readonly string[]) =>
          detectCollisions(uids.map((uid) => me(uid, 'custom'))).isOk(),
      ),
    )
  })
})

describe('collectAliasRoutes', () => {
  test('collectAliasRoutes:noAliases:emptyArray', () => {
    expect(collectAliasRoutes([me('a', 'custom')])._unsafeUnwrap()).toHaveLength(0)
  })

  test('collectAliasRoutes:twoAliases:twoRoutes', () => {
    const routes = collectAliasRoutes([
      me('a', 'custom', ['old-a', 'alt-a']),
    ])._unsafeUnwrap()

    expect(routes).toHaveLength(2)
    expect(routes.every((route) => route.uid === 'a')).toBe(true)
  })

  test('collectAliasRoutes:aliasCollision:returnsErrWithBothOwners', () => {
    const result = collectAliasRoutes([
      me('a', 'custom', ['shared']),
      me('b', 'custom', ['shared']),
    ])

    expect(result.isErr()).toBe(true)

    const error = expectAliasCollision(result._unsafeUnwrapErr())
    expect(error.collisions).toHaveLength(1)
    expect(error.collisions[0]!.alias).toBe('shared')
    expect(error.collisions[0]!.owners).toContain('a')
    expect(error.collisions[0]!.owners).toContain('b')
  })

  test('collectAliasRoutes:multipleAliasCollisions:reportsAll', () => {
    const result = collectAliasRoutes([
      me('a', 'vault', ['shared-1', 'shared-2']),
      me('b', 'feed', ['shared-1', 'shared-2']),
    ])

    expect(result.isErr()).toBe(true)

    const error = expectAliasCollision(result._unsafeUnwrapErr())
    expect(error.collisions).toHaveLength(2)

    const aliases = error.collisions.map((collision) => collision.alias)
    expect(aliases).toContain('shared-1')
    expect(aliases).toContain('shared-2')
  })
})
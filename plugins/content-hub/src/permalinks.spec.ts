import * as fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { slugArb } from '../test/arbitraries.ts'
import { buildEntry } from '../test/builders.ts'
import { expectErr, expectOk, isTddEnabled } from '../test/helpers.ts'
import { collectAliasRoutes, detectCollisions } from './permalinks.ts'

const tdd = isTddEnabled()

// ─── detectCollisions ────────────────────────────────────────────────────────

describe('detectCollisions', () => {
  test('no collision returns ok with uid map', () => {
    const entries = [buildEntry({ uid: 'a', title: 'A' }), buildEntry({ uid: 'b', title: 'B' })]
    const result = detectCollisions(entries)
    expectOk(result)
    expect(result._unsafeUnwrap().has('a')).toBe(true)
    expect(result._unsafeUnwrap().has('b')).toBe(true)
  })

  test('duplicate uid returns err with UidCollision type', () => {
    const entries = [buildEntry({ uid: 'same', title: 'A' }), buildEntry({ uid: 'same', title: 'B' })]
    const result = detectCollisions(entries)
    expectErr(result)
    expect(result._unsafeUnwrapErr().type).toBe('UidCollision')
  })
})

// ─── collectAliasRoutes ──────────────────────────────────────────────────────

describe('collectAliasRoutes', () => {
  test('returns alias→uid mapping for each alias', () => {
    const entries = [buildEntry({ uid: 'new-slug', aliases: ['old-slug', 'another-old'] })]
    const result = collectAliasRoutes(entries)
    expectOk(result)
    const routes = result._unsafeUnwrap()
    expect(routes).toHaveLength(2)
    expect(routes.find(r => r.alias === 'old-slug')?.uid).toBe('new-slug')
    expect(routes.find(r => r.alias === 'another-old')?.uid).toBe('new-slug')
  })

  test('no aliases returns empty array', () => {
    const entries = [buildEntry({ uid: 'a', aliases: [] })]
    const result = collectAliasRoutes(entries)
    expectOk(result)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })

  test('alias claimed by two entries returns err with AliasCollision type', () => {
    const entries = [
      buildEntry({ uid: 'a', aliases: ['shared'] }),
      buildEntry({ uid: 'b', aliases: ['shared'] }),
    ]
    const result = collectAliasRoutes(entries)
    expectErr(result)
    expect(result._unsafeUnwrapErr().type).toBe('AliasCollision')
  })

  test('collectAliasRoutes maps aliases to bare uid values', () => {
    const entries = [buildEntry({ uid: 'post', aliases: ['old-post'] })]
    const result = collectAliasRoutes(entries)
    expectOk(result)
    const route = result._unsafeUnwrap()[0]!
    expect(route.alias).toBe('old-post')
    expect(route.uid).toBe('post')
  })
})

// ─── property tests ──────────────────────────────────────────────────────────

describe('detectCollisions — property tests', () => {
  test.skipIf(!tdd)('unique uids never produce a collision', () => {
    fc.assert(fc.property(fc.uniqueArray(slugArb, { minLength: 1, maxLength: 20 }), uids => {
      const entries = uids.map(uid => buildEntry({ uid }))
      expectOk(detectCollisions(entries))
    }))
  })
})

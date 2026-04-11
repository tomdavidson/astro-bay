import * as fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { isTddEnabled } from '../test/helpers.ts'
import { paginate } from './paginate.ts'

const tdd = isTddEnabled()

const range = (n: number): readonly number[] => Array.from({ length: n }, (_, i) => i)

describe('paginate', () => {
  test('first page contains first pageSize items', () => {
    const slice = paginate(range(10), 1, 3)
    expect(slice.entries).toEqual([0, 1, 2])
  })

  test('last page contains remaining items', () => {
    const slice = paginate(range(10), 4, 3)
    expect(slice.entries).toEqual([9])
  })

  test('page beyond total returns empty entries', () => {
    const slice = paginate(range(5), 99, 3)
    expect(slice.entries).toHaveLength(0)
    expect(slice.totalPages).toBe(2)
    expect(slice.currentPage).toBe(99)
    expect(slice.hasPrev).toBe(true)
    expect(slice.hasNext).toBe(false)
  })

  test('totalPages is 1 for empty input', () => {
    const slice = paginate([], 1, 10)
    expect(slice.totalPages).toBe(1)
    expect(slice.entries).toHaveLength(0)
  })

  test('hasPrev false on first page', () => {
    expect(paginate(range(20), 1, 5).hasPrev).toBe(false)
  })

  test('hasPrev true on second page', () => {
    expect(paginate(range(20), 2, 5).hasPrev).toBe(true)
  })

  test('hasNext true when not on last page', () => {
    expect(paginate(range(20), 1, 5).hasNext).toBe(true)
  })

  test('hasNext false on last page', () => {
    const last = paginate(range(20), 1, 5).totalPages
    expect(paginate(range(20), last, 5).hasNext).toBe(false)
  })
})

describe('paginate — property tests', () => {
  test.skipIf(!tdd)('total entries across all pages equals input length', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (items, pageSize) => {
          const totalPages = paginate(items, 1, pageSize).totalPages
          const collected = Array.from({ length: totalPages }, (_, i) => i + 1).flatMap(p =>
            paginate(items, p, pageSize).entries
          )
          expect(collected).toEqual(items)
        },
      ),
    )
  })

  test.skipIf(!tdd)('no page returns more items than pageSize', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (items, pageSize, page) => {
          expect(paginate(items, page, pageSize).entries.length).toBeLessThanOrEqual(pageSize)
        },
      ),
    )
  })

  test.skipIf(!tdd)('total is always >= 1', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (items, pageSize) => {
          expect(paginate(items, 1, pageSize).totalPages).toBeGreaterThanOrEqual(1)
        },
      ),
    )
  })
})

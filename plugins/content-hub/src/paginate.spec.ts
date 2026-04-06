import { describe, expect, test } from 'vitest'
import { paginate } from './paginate.ts'
import { isTddEnabled } from '../test/helpers.ts'

const tdd = isTddEnabled()
const items = Array.from({ length: 25 }, (_, i) => i + 1)

describe('paginate', () => {
    test('paginate_firstPage_correctSliceAndMetadata', () => {
        const r = paginate(items, 1, 10)

        expect(r.entries).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        expect(r.currentPage).toBe(1)
        expect(r.totalPages).toBe(3)
        expect(r.totalEntries).toBe(25)
        expect(r.hasPrev).toBe(false)
        expect(r.hasNext).toBe(true)
        expect(r.prevPage).toBeUndefined()
        expect(r.nextPage).toBe(2)
    })

    test('paginate_lastPage_partialSliceAndMetadata', () => {
        const r = paginate(items, 3, 10)

        expect(r.entries).toEqual([21, 22, 23, 24, 25])
        expect(r.currentPage).toBe(3)
        expect(r.totalPages).toBe(3)
        expect(r.totalEntries).toBe(25)
        expect(r.hasPrev).toBe(true)
        expect(r.hasNext).toBe(false)
        expect(r.prevPage).toBe(2)
        expect(r.nextPage).toBeUndefined()
    })

    test('paginate_pageBeyondMax_clampedToLast', () => {
        const r = paginate(items, 999, 10)

        expect(r.currentPage).toBe(3)
        expect(r.entries).toEqual([21, 22, 23, 24, 25])
    })

    test('paginate_pageZero_clampedToFirst', () => {
        const r = paginate(items, 0, 10)

        expect(r.currentPage).toBe(1)
        expect(r.entries).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    test('paginate_negativePage_clampedToFirst', () => {
        const r = paginate(items, -5, 10)

        expect(r.currentPage).toBe(1)
        expect(r.entries).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    test('paginate_emptyArray_onePageNoEntries', () => {
        const r = paginate([], 1, 10)

        expect(r.entries).toEqual([])
        expect(r.currentPage).toBe(1)
        expect(r.totalPages).toBe(1)
        expect(r.totalEntries).toBe(0)
        expect(r.hasPrev).toBe(false)
        expect(r.hasNext).toBe(false)
        expect(r.prevPage).toBeUndefined()
        expect(r.nextPage).toBeUndefined()
    })

    test('paginate_exactBoundary_secondPage_fullSlice', () => {
        const r = paginate(Array.from({ length: 20 }, (_, i) => i + 1), 2, 10)

        expect(r.entries).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
        expect(r.currentPage).toBe(2)
        expect(r.totalPages).toBe(2)
        expect(r.totalEntries).toBe(20)
        expect(r.hasPrev).toBe(true)
        expect(r.hasNext).toBe(false)
        expect(r.prevPage).toBe(1)
        expect(r.nextPage).toBeUndefined()
    })

    test('paginate_singlePage_hasNoPrevOrNext', () => {
        const r = paginate([1, 2, 3], 1, 10)

        expect(r.entries).toEqual([1, 2, 3])
        expect(r.currentPage).toBe(1)
        expect(r.totalPages).toBe(1)
        expect(r.totalEntries).toBe(3)
        expect(r.hasPrev).toBe(false)
        expect(r.hasNext).toBe(false)
        expect(r.prevPage).toBeUndefined()
        expect(r.nextPage).toBeUndefined()
    })

    test.skipIf(tdd)('paginate_entriesNeverExceedPageSize', async () => {
        const fc = await import('fast-check')

        fc.assert(
            fc.property(
                fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
                fc.integer({ min: -10, max: 100 }),
                fc.integer({ min: 1, max: 50 }),
                (arr, page, size) => paginate(arr, page, size).entries.length <= size,
            ),
        )
    })

    test.skipIf(tdd)('paginate_currentPageAlwaysInRange', async () => {
        const fc = await import('fast-check')

        fc.assert(
            fc.property(
                fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
                fc.integer({ min: -10, max: 100 }),
                fc.integer({ min: 1, max: 50 }),
                (arr, page, size) => {
                    const r = paginate(arr, page, size)
                    return r.currentPage >= 1 && r.currentPage <= r.totalPages
                },
            ),
        )
    })

    test.skipIf(tdd)('paginate_entriesAreExactContiguousSlice', async () => {
        const fc = await import('fast-check')

        fc.assert(
            fc.property(
                fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
                fc.integer({ min: -10, max: 100 }),
                fc.integer({ min: 1, max: 50 }),
                (arr, page, size) => {
                    const r = paginate(arr, page, size)
                    const expectedStart = (r.currentPage - 1) * size
                    return JSON.stringify(r.entries) === JSON.stringify(arr.slice(expectedStart, expectedStart + size))
                },
            ),
        )
    })

    test.skipIf(tdd)('paginate_prevNextMetadataIsConsistent', async () => {
        const fc = await import('fast-check')

        fc.assert(
            fc.property(
                fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
                fc.integer({ min: -10, max: 100 }),
                fc.integer({ min: 1, max: 50 }),
                (arr, page, size) => {
                    const r = paginate(arr, page, size)

                    return (
                        r.hasPrev === (r.currentPage > 1) &&
                        r.hasNext === (r.currentPage < r.totalPages) &&
                        r.prevPage === (r.currentPage > 1 ? r.currentPage - 1 : undefined) &&
                        r.nextPage === (r.currentPage < r.totalPages ? r.currentPage + 1 : undefined)
                    )
                },
            ),
        )
    })
})
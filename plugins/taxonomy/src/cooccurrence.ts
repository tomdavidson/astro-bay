// Co-occurrence matrix builder. Operates on raw topic arrays.
// Input is derived from content entries (provided by the imperative shell).
// Output is a pure data structure consumed by provider implementations.

export type CoOccurrenceMatrix = ReadonlyMap<string, ReadonlyMap<string, number>>

export type CoOccurrenceEntry = {
  readonly topics: ReadonlyArray<string>
}

export const buildCoOccurrenceMatrix = (
  entries: ReadonlyArray<CoOccurrenceEntry>,
): CoOccurrenceMatrix => {
  const matrix = new Map<string, Map<string, number>>()

  const inc = (a: string, b: string) => {
    const row = matrix.get(a) ?? new Map<string, number>()
    row.set(b, (row.get(b) ?? 0) + 1)
    matrix.set(a, row)
  }

  for (const entry of entries) {
    const topics = [...new Set(entry.topics)] // deduplicate within one entry
    for (let i = 0; i < topics.length; i++) {
      for (let j = 0; j < topics.length; j++) {
        if (i !== j) {
          inc(topics[i]!, topics[j]!)
        }
      }
    }
  }

  return matrix as CoOccurrenceMatrix
}

export const topCoOccurrences = (
  slug: string,
  matrix: CoOccurrenceMatrix,
  topN: number,
): ReadonlyArray<{ slug: string; count: number }> => {
  const row = matrix.get(slug)
  if (!row) return []
  return [...row.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([s, count]) => ({ slug: s, count }))
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any
  const t = test as any
  const tdd = !!import.meta.env?.TDD

  describe('buildCoOccurrenceMatrix', () => {
    test('buildCoOccurrenceMatrix/empty/empty', () => {
      expect(buildCoOccurrenceMatrix([]).size).toBe(0)
    })
    test('buildCoOccurrenceMatrix/singleEntry/symmetric', () => {
      const m = buildCoOccurrenceMatrix([{ topics: ['housing', 'zoning'] }])
      expect(m.get('housing')?.get('zoning')).toBe(1)
      expect(m.get('zoning')?.get('housing')).toBe(1)
    })
    test('buildCoOccurrenceMatrix/selfCoOccurrence/notPresent', () => {
      const m = buildCoOccurrenceMatrix([{ topics: ['housing', 'housing'] }])
      expect(m.get('housing')?.get('housing')).toBeUndefined()
    })
    test('buildCoOccurrenceMatrix/multipleEntries/countsAccumulate', () => {
      const entries = [
        { topics: ['housing', 'zoning'] },
        { topics: ['housing', 'zoning'] },
        { topics: ['housing', 'courts'] },
      ]
      const m = buildCoOccurrenceMatrix(entries)
      expect(m.get('housing')?.get('zoning')).toBe(2)
      expect(m.get('housing')?.get('courts')).toBe(1)
    })
    test('buildCoOccurrenceMatrix/duplicateTopicsInEntry/countedOnce', () => {
      const m = buildCoOccurrenceMatrix([{ topics: ['housing', 'housing', 'zoning'] }])
      expect(m.get('housing')?.get('zoning')).toBe(1)
    })

    t.skipIf(tdd)('buildCoOccurrenceMatrix/alwaysSymmetric', async () => {
      const { default: fc } = await import('fast-check')
      const topicArb = fc.string({ minLength: 1, maxLength: 10 })
      const entryArb = fc.record({ topics: fc.array(topicArb, { maxLength: 5 }) })
      fc.assert(fc.property(fc.array(entryArb, { maxLength: 10 }), (entries) => {
        const m = buildCoOccurrenceMatrix(entries)
        for (const [a, row] of m) {
          for (const [b, count] of row) {
            const reverse = m.get(b)?.get(a)
            if (reverse !== count) return false
          }
        }
        return true
      }))
    })
  })

  describe('topCoOccurrences', () => {
    test('topCoOccurrences/unknown/empty', () => {
      expect(topCoOccurrences('unknown', new Map(), 5)).toHaveLength(0)
    })
    test('topCoOccurrences/sortedDescending', () => {
      const entries = [
        { topics: ['a', 'b'] },
        { topics: ['a', 'b'] },
        { topics: ['a', 'c'] },
      ]
      const m = buildCoOccurrenceMatrix(entries)
      const top = topCoOccurrences('a', m, 5)
      expect(top[0]?.slug).toBe('b')
      expect(top[0]?.count).toBe(2)
      expect(top[1]?.slug).toBe('c')
    })
    test('topCoOccurrences/topNRespected', () => {
      const entries = [
        { topics: ['a', 'b', 'c', 'd'] },
      ]
      const m = buildCoOccurrenceMatrix(entries)
      expect(topCoOccurrences('a', m, 2)).toHaveLength(2)
    })

    t.skipIf(tdd)('topCoOccurrences/neverExceedsTopN', async () => {
      const { default: fc } = await import('fast-check')
      const topicArb = fc.constantFrom('a', 'b', 'c', 'd', 'e')
      const entryArb = fc.record({ topics: fc.array(topicArb, { maxLength: 5 }) })
      fc.assert(fc.property(
        fc.array(entryArb, { maxLength: 10 }),
        fc.integer({ min: 0, max: 10 }),
        (entries, n) => {
          const m = buildCoOccurrenceMatrix(entries)
          return topCoOccurrences('a', m, n).length <= n
        }
      ))
    })
  })
}

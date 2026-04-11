import { describe, expect, test } from 'vitest'
import { loadTaxonomyGraph } from './transform/ancestors.ts'

describe('loadTaxonomyGraph', () => {
  test('returns undefined or a graph object and never throws', async () => {
    await expect(loadTaxonomyGraph()).resolves.toSatisfy((value: unknown) =>
      value === undefined ||
      (typeof value === 'object' && value !== null && 'edges' in value && 'ancestors' in value)
    )
  })
})

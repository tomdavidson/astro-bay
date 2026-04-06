import * as fc from 'fast-check'
import type { TaxonomyEdge, SynonymGroup, TaxonomyFragment } from '../types.ts'

export const slugArb = fc
  .array(
    fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z0-9]+$/.test(s)),
    { minLength: 1, maxLength: 3 },
  )
  .map(parts => parts.join('-'))

export const edgeArb: fc.Arbitrary<TaxonomyEdge> = fc.record({
  parent: slugArb,
  child: slugArb,
  confidence: fc.option(fc.float({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
  source: fc.option(fc.constantFrom('derived' as const, 'curated' as const, 'external' as const), { nil: undefined }),
})

export const synonymArb: fc.Arbitrary<SynonymGroup> = fc.record({
  canonical: slugArb,
  variants: fc.array(slugArb, { minLength: 1, maxLength: 3 }),
  confidence: fc.option(fc.float({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
  source: fc.option(fc.constantFrom('derived' as const, 'curated' as const, 'external' as const), { nil: undefined }),
})

export const fragmentArb: fc.Arbitrary<TaxonomyFragment> = fc.record({
  edges: fc.array(edgeArb, { maxLength: 8 }),
  synonyms: fc.array(synonymArb, { maxLength: 4 }),
})

// Compose multiple TaxonomyFragments from multiple providers into a single ResolvedGraph.
// Pure orchestration — no IO. Provider.load() calls happen in the imperative shell.

import { err, ok, type Result } from 'neverthrow'
import { emptyGraph, mergeFragment } from './graph.ts'
import type { ResolvedGraph, TaxonomyError, TaxonomyFragment } from './types.ts'

export type ProviderResult = { readonly name: string; readonly fragment: TaxonomyFragment }

export const composeFragments = (
  providerResults: ReadonlyArray<ProviderResult>,
): Result<ResolvedGraph, TaxonomyError & { type: 'CycleDetected' }> => {
  let graph = emptyGraph()
  for (const { fragment } of providerResults) {
    const result = mergeFragment(graph, fragment)
    if (result.isErr()) return err(result.error)
    graph = result.value
  }
  return ok(graph)
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any

  describe('composeFragments', () => {
    test('composeFragments/empty/emptyGraph', () => {
      const result = composeFragments([])
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.edges.size).toBe(0)
      }
    })
    test('composeFragments/singleProvider/appliesFragment', () => {
      const pr: ProviderResult = {
        name: 'file',
        fragment: { edges: [{ parent: 'housing', child: 'zoning' }], synonyms: [] },
      }
      const result = composeFragments([pr])
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.edges.get('housing')?.has('zoning')).toBe(true)
      }
    })
    test('composeFragments/laterProviderRejectionWins', () => {
      const base: ProviderResult = {
        name: 'derived',
        fragment: { edges: [{ parent: 'housing', child: 'zoning' }], synonyms: [] },
      }
      const curated: ProviderResult = {
        name: 'file',
        fragment: { edges: [], synonyms: [], rejections: [{ parent: 'housing', child: 'zoning' }] },
      }
      const result = composeFragments([base, curated])
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.edges.get('housing')?.has('zoning')).toBeFalsy()
      }
    })
    test('composeFragments/cycle/returnsErr', () => {
      const pr: ProviderResult = {
        name: 'bad',
        fragment: { edges: [{ parent: 'a', child: 'b' }, { parent: 'b', child: 'a' }], synonyms: [] },
      }
      expect(composeFragments([pr]).isErr()).toBe(true)
    })
    test('composeFragments/synonymsMergedAcrossProviders', () => {
      const p1: ProviderResult = {
        name: 'a',
        fragment: { edges: [], synonyms: [{ canonical: 'public-transit', variants: ['transit'] }] },
      }
      const p2: ProviderResult = {
        name: 'b',
        fragment: { edges: [], synonyms: [{ canonical: 'housing', variants: ['homes'] }] },
      }
      const result = composeFragments([p1, p2])
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.synonyms.get('transit')).toBe('public-transit')
        expect(result.value.synonyms.get('homes')).toBe('housing')
      }
    })
  })
}

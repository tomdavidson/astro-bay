// Graph construction, cycle detection, and query helpers.
// Pure functions. No IO.

import { err, ok, type Result } from 'neverthrow'
import type { ResolvedGraph, SynonymGroup, TaxonomyEdge, TaxonomyError, TaxonomyFragment } from './types.ts'

// --- Cycle detection ---

const dfsHasCycle = (
  node: string,
  edges: ReadonlyMap<string, ReadonlySet<string>>,
  visited: Set<string>,
  stack: Set<string>,
  path: string[],
): string[] | null => {
  visited.add(node)
  stack.add(node)
  path.push(node)
  for (const child of edges.get(node) ?? []) {
    if (!visited.has(child)) {
      const result = dfsHasCycle(child, edges, visited, stack, [...path])
      if (result) return result
    } else if (stack.has(child)) {
      return [...path, child]
    }
  }
  stack.delete(node)
  return null
}

export const detectCycle = (
  edges: ReadonlyMap<string, ReadonlySet<string>>,
): Result<true, TaxonomyError & { type: 'CycleDetected' }> => {
  const visited = new Set<string>()
  const stack = new Set<string>()
  for (const node of edges.keys()) {
    if (!visited.has(node)) {
      const cycle = dfsHasCycle(node, edges, visited, stack, [])
      if (cycle) return err({ type: 'CycleDetected', path: cycle })
    }
  }
  return ok(true)
}

// --- Fragment merge ---

export const mergeFragment = (
  current: ResolvedGraph,
  fragment: TaxonomyFragment,
): Result<ResolvedGraph, TaxonomyError & { type: 'CycleDetected' }> => {
  // Apply rejections first
  const rejectionSet = new Set((fragment.rejections ?? []).map(r => `${r.parent}::${r.child}`))

  // Build mutable working copy of edges
  const edgeMap = new Map<string, Set<string>>()
  for (const [parent, children] of current.edges) {
    edgeMap.set(parent, new Set(children))
  }

  // Remove rejected edges
  for (const r of fragment.rejections ?? []) {
    edgeMap.get(r.parent)?.delete(r.child)
  }

  // Add new edges (later provider wins — add if not rejected)
  for (const edge of fragment.edges) {
    const key = `${edge.parent}::${edge.child}`
    if (!rejectionSet.has(key)) {
      const set = edgeMap.get(edge.parent) ?? new Set<string>()
      set.add(edge.child)
      edgeMap.set(edge.parent, set)
    }
  }

  const frozenEdges = new Map<string, ReadonlySet<string>>(
    [...edgeMap.entries()].map(([k, v]) => [k, v as ReadonlySet<string>]),
  )

  const cycleResult = detectCycle(frozenEdges)
  if (cycleResult.isErr()) return err(cycleResult.error)

  // Merge synonyms: later provider wins on canonical for same variant
  const synonymMap = new Map(current.synonyms)
  for (const group of fragment.synonyms) {
    synonymMap.set(group.canonical, group.canonical)
    for (const variant of group.variants) {
      synonymMap.set(variant, group.canonical)
    }
  }

  // Merge labels from new edges
  const labels = new Map(current.labels)
  for (const edge of fragment.edges) {
    if (!labels.has(edge.parent)) labels.set(edge.parent, edge.parent)
    if (!labels.has(edge.child)) labels.set(edge.child, edge.child)
  }
  for (const group of fragment.synonyms) {
    if (!labels.has(group.canonical)) labels.set(group.canonical, group.canonical)
  }

  return ok({
    edges: frozenEdges,
    synonyms: synonymMap as ReadonlyMap<string, string>,
    labels: labels as ReadonlyMap<string, string>,
  })
}

export const emptyGraph = (): ResolvedGraph => ({ edges: new Map(), synonyms: new Map(), labels: new Map() })

// --- Query helpers ---

export const ancestors = (
  slug: string,
  graph: ResolvedGraph,
): ReadonlyArray<{ slug: string; label: string }> => {
  const result: Array<{ slug: string; label: string }> = []
  const visited = new Set<string>()
  const queue = [slug]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const [parent, children] of graph.edges) {
      if (children.has(current) && !visited.has(parent) && parent !== slug) {
        visited.add(parent)
        result.push({ slug: parent, label: graph.labels.get(parent) ?? parent })
        queue.push(parent)
      }
    }
  }
  return result
}

export const children = (
  slug: string,
  graph: ResolvedGraph,
): ReadonlyArray<{ slug: string; label: string }> =>
  [...(graph.edges.get(slug) ?? [])].map(s => ({ slug: s, label: graph.labels.get(s) ?? s }))

export const canonicalize = (slug: string, graph: ResolvedGraph): string => graph.synonyms.get(slug) ?? slug

export const labelFor = (slug: string, graph: ResolvedGraph): string =>
  graph.labels.get(canonicalize(slug, graph)) ??
    slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any
  const t = test as any
  const tdd = !!import.meta.env?.TDD

  // --- detectCycle ---
  describe('detectCycle', () => {
    test('detectCycle/linearChain/ok', () => {
      const edges = new Map([['housing', new Set(['affordable-housing'])], [
        'affordable-housing',
        new Set(['rent-control']),
      ]])
      expect(detectCycle(edges).isOk()).toBe(true)
    })
    test('detectCycle/diamond/ok', () => {
      const edges = new Map([['a', new Set(['b', 'c'])], ['b', new Set(['d'])], ['c', new Set(['d'])]])
      expect(detectCycle(edges).isOk()).toBe(true)
    })
    test('detectCycle/selfLoop/err', () => {
      const edges = new Map([['a', new Set(['a'])]])
      const result = detectCycle(edges)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) expect(result.error.type).toBe('CycleDetected')
    })
    test('detectCycle/mutualReference/err', () => {
      const edges = new Map([['a', new Set(['b'])], ['b', new Set(['a'])]])
      expect(detectCycle(edges).isErr()).toBe(true)
    })
    test('detectCycle/empty/ok', () => {
      expect(detectCycle(new Map()).isOk()).toBe(true)
    })

    t.skipIf(tdd)('detectCycle/dagAlwaysOk', async () => {
      const { default: fc } = await import('fast-check')
      // A DAG: edges only go from lower index to higher index
      const dagArb = fc.array(fc.tuple(fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 4 })), {
        maxLength: 8,
      }).map((pairs: [number, number][]) => {
        const m = new Map<string, Set<string>>()
        for (const [a, b] of pairs) {
          if (a >= b) continue // enforce DAG direction
          const key = `n${a}`
          const set = m.get(key) ?? new Set<string>()
          set.add(`n${b}`)
          m.set(key, set)
        }
        return m as ReadonlyMap<string, ReadonlySet<string>>
      })
      fc.assert(fc.property(dagArb, edges => detectCycle(edges).isOk()))
    })
  })

  // --- mergeFragment ---
  describe('mergeFragment', () => {
    const empty = emptyGraph()

    test('mergeFragment/emptyFragment/returnsEmpty', () => {
      const result = mergeFragment(empty, { edges: [], synonyms: [] })
      expect(result.isOk()).toBe(true)
    })
    test('mergeFragment/singleEdge/added', () => {
      const frag = { edges: [{ parent: 'housing', child: 'zoning' }], synonyms: [] }
      const result = mergeFragment(empty, frag)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.edges.get('housing')?.has('zoning')).toBe(true)
      }
    })
    test('mergeFragment/rejection/removesEdge', () => {
      const graph: ResolvedGraph = {
        edges: new Map([['housing', new Set(['zoning']) as ReadonlySet<string>]]),
        synonyms: new Map(),
        labels: new Map(),
      }
      const frag = { edges: [], synonyms: [], rejections: [{ parent: 'housing', child: 'zoning' }] }
      const result = mergeFragment(graph, frag)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.edges.get('housing')?.has('zoning')).toBeFalsy()
      }
    })
    test('mergeFragment/cycle/returnsErr', () => {
      const frag = { edges: [{ parent: 'a', child: 'b' }, { parent: 'b', child: 'a' }], synonyms: [] }
      expect(mergeFragment(empty, frag).isErr()).toBe(true)
    })
    test('mergeFragment/synonym/mapped', () => {
      const frag = {
        edges: [],
        synonyms: [{ canonical: 'public-transit', variants: ['public-transportation'] }],
      }
      const result = mergeFragment(empty, frag)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.synonyms.get('public-transportation')).toBe('public-transit')
        expect(result.value.synonyms.get('public-transit')).toBe('public-transit')
      }
    })
  })

  // --- ancestors ---
  describe('ancestors', () => {
    const graph: ResolvedGraph = {
      edges: new Map<string, ReadonlySet<string>>([[
        'housing',
        new Set(['affordable-housing', 'rent-control']) as ReadonlySet<string>,
      ]]),
      synonyms: new Map(),
      labels: new Map([['housing', 'Housing']]),
    }

    test('ancestors/directParent/returned', () => {
      const result = ancestors('affordable-housing', graph)
      expect(result.map(a => a.slug)).toContain('housing')
    })
    test('ancestors/topLevel/empty', () => {
      expect(ancestors('housing', graph)).toHaveLength(0)
    })
    test('ancestors/unknown/empty', () => {
      expect(ancestors('unknown-topic', graph)).toHaveLength(0)
    })
    test('ancestors/neverContainsSelf', () => {
      const result = ancestors('affordable-housing', graph)
      expect(result.map(a => a.slug)).not.toContain('affordable-housing')
    })

    t.skipIf(tdd)('ancestors/noDuplicates', async () => {
      const { default: fc } = await import('fast-check')
      const g = graph
      fc.assert(
        fc.property(
          fc.constantFrom('housing', 'affordable-housing', 'rent-control', 'unknown'),
          (slug: string) => {
            const result = ancestors(slug, g)
            const slugs = result.map(a => a.slug)
            return slugs.length === new Set(slugs).size
          },
        ),
      )
    })
  })

  // --- canonicalize ---
  describe('canonicalize', () => {
    const graph: ResolvedGraph = {
      edges: new Map(),
      synonyms: new Map([['public-transportation', 'public-transit'], ['public-transit', 'public-transit']]),
      labels: new Map(),
    }

    test('canonicalize/variant/returnsCanonical', () => {
      expect(canonicalize('public-transportation', graph)).toBe('public-transit')
    })
    test('canonicalize/canonical/returnsItself', () => {
      expect(canonicalize('public-transit', graph)).toBe('public-transit')
    })
    test('canonicalize/unknown/returnsSlug', () => {
      expect(canonicalize('unknown', graph)).toBe('unknown')
    })

    t.skipIf(tdd)('canonicalize/idempotent', async () => {
      const { default: fc } = await import('fast-check')
      fc.assert(
        fc.property(
          fc.constantFrom('public-transit', 'public-transportation', 'housing', 'unknown'),
          (slug: string) => canonicalize(canonicalize(slug, graph), graph) === canonicalize(slug, graph),
        ),
      )
    })
  })
}

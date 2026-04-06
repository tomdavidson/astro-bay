// Vite virtual module plugin for astro-taxonomy:graph (or custom module ID).
// Exposes the resolved graph to all Astro pages and integrations at build time.

import type { ResolvedGraph } from './types.ts'
import type { Plugin } from 'vite'

export const makeVirtualModulePlugin = (
  moduleId: string,
  getGraph: () => ResolvedGraph | null,
): Plugin => {
  const RESOLVED_ID = '\0' + moduleId

  return {
    name: 'astro-taxonomy-virtual',
    resolveId(id: string) {
      return id === moduleId ? RESOLVED_ID : null
    },
    load(id: string) {
      if (id !== RESOLVED_ID) return null
      const graph = getGraph()
      if (!graph) {
        // Return an empty graph shell before providers have loaded
        return `
          export const edges = new Map()
          export const synonyms = new Map()
          export const labels = new Map()
          export const graph = { edges, synonyms, labels }
          export default graph
        `
      }

      // Serialize Maps to JSON-portable arrays, then reconstruct on the client side.
      const edgesArray = [...graph.edges.entries()].map(([k, v]) => [k, [...v]])
      const synonymsArray = [...graph.synonyms.entries()]
      const labelsArray = [...graph.labels.entries()]

      return `
        export const edges = new Map(${JSON.stringify(edgesArray)}.map(([k,v]) => [k, new Set(v)]))
        export const synonyms = new Map(${JSON.stringify(synonymsArray)})
        export const labels = new Map(${JSON.stringify(labelsArray)})
        export const graph = { edges, synonyms, labels }
        export default graph
      `
    },
  }
}

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any

  describe('makeVirtualModulePlugin', () => {
    test('makeVirtualModulePlugin/unknownId/returnsNull', () => {
      const plugin = makeVirtualModulePlugin('astro-taxonomy:graph', () => null)
      expect((plugin as any).resolveId('other-module')).toBeNull()
    })
    test('makeVirtualModulePlugin/matchingId/returnsResolvedId', () => {
      const plugin = makeVirtualModulePlugin('astro-taxonomy:graph', () => null)
      expect((plugin as any).resolveId('astro-taxonomy:graph')).toBe('\0astro-taxonomy:graph')
    })
    test('makeVirtualModulePlugin/nullGraph/returnsEmptyShell', () => {
      const plugin = makeVirtualModulePlugin('astro-taxonomy:graph', () => null)
      const output = (plugin as any).load('\0astro-taxonomy:graph') as string
      expect(output).toContain('new Map()')
    })
    test('makeVirtualModulePlugin/withGraph/includesEdgeData', () => {
      const graph: ResolvedGraph = {
        edges: new Map([['housing', new Set(['zoning']) as ReadonlySet<string>]]),
        synonyms: new Map(),
        labels: new Map([['housing', 'Housing']]),
      }
      const plugin = makeVirtualModulePlugin('astro-taxonomy:graph', () => graph)
      const output = (plugin as any).load('\0astro-taxonomy:graph') as string
      expect(output).toContain('housing')
      expect(output).toContain('zoning')
    })
    test('makeVirtualModulePlugin/customModuleId/resolves', () => {
      const plugin = makeVirtualModulePlugin('my-site:taxonomy', () => null)
      expect((plugin as any).resolveId('my-site:taxonomy')).toBe('\0my-site:taxonomy')
      expect((plugin as any).resolveId('astro-taxonomy:graph')).toBeNull()
    })
  })
}

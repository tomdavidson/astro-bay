// fileProvider: reads/writes a curated JSON file from disk.
// This is an imperative provider — reads a file, returns a fragment.
// The load() function does IO; it is not in-file tested. Test with a fixture at Layer 2.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { ok, err, type Result } from 'neverthrow'
import { z } from 'zod'
import type { TaxonomyProvider, TaxonomyFragment, ResolvedGraph, TaxonomyContext, TaxonomyError } from '../types.ts'

const EdgeSchema = z.object({
  parent: z.string(),
  child: z.string(),
  confidence: z.number().optional(),
  signals: z.array(z.string()).optional(),
  source: z.enum(['derived', 'curated', 'external']).optional(),
})

const SynonymSchema = z.object({
  canonical: z.string(),
  variants: z.array(z.string()),
  confidence: z.number().optional(),
  source: z.enum(['derived', 'curated', 'external']).optional(),
})

const RejectionSchema = z.object({
  parent: z.string(),
  child: z.string(),
})

const TaxonomyFileSchema = z.object({
  edges: z.array(EdgeSchema).default([]),
  synonyms: z.array(SynonymSchema).default([]),
  rejections: z.array(RejectionSchema).optional(),
})

const parseFile = (
  filePath: string,
): Result<TaxonomyFragment, TaxonomyError & { type: 'FileNotFound' | 'ParseError' }> => {
  if (!existsSync(filePath)) {
    return err({ type: 'FileNotFound', path: filePath })
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'))
    const parsed = TaxonomyFileSchema.parse(raw)
    return ok(parsed as TaxonomyFragment)
  } catch (e) {
    return err({
      type: 'ParseError',
      path: filePath,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}

const serializeGraph = (graph: ResolvedGraph): TaxonomyFragment => ({
  edges: [...graph.edges.entries()].flatMap(([parent, children]) =>
    [...children].map(child => ({ parent, child, source: 'curated' as const }))
  ),
  synonyms: [...new Set(graph.synonyms.values())].map(canonical => ({
    canonical,
    variants: [...graph.synonyms.entries()]
      .filter(([v, c]) => c === canonical && v !== canonical)
      .map(([v]) => v),
    source: 'curated' as const,
  })).filter(g => g.variants.length > 0),
})

export type FileProviderOptions = {
  readonly path: string
  readonly optional?: boolean
}

export const fileProvider = (options: FileProviderOptions): TaxonomyProvider => ({
  name: `file:${options.path}`,
  watchPaths: [options.path],

  async load(_ctx: TaxonomyContext): Promise<TaxonomyFragment> {
    const result = parseFile(options.path)
    if (result.isOk()) return result.value
    if (result.error.type === 'FileNotFound' && options.optional) {
      return { edges: [], synonyms: [] }
    }
    throw new Error(
      `[astro-taxonomy] fileProvider failed: ${result.error.type} — ${
        result.error.type === 'ParseError' ? result.error.message : result.error.path
      }`
    )
  },

  async save(graph: ResolvedGraph): Promise<void> {
    const fragment = serializeGraph(graph)
    writeFileSync(options.path, JSON.stringify(fragment, null, 2) + '\n', 'utf8')
  },
})

// parseFile is pure (modulo filesystem) — we test the schema validation logic here,
// not the file read. Full IO round-trip belongs at Layer 2.
if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any

  describe('serializeGraph', () => {
    test('serializeGraph/emptyGraph/emptyFragment', () => {
      const graph: ResolvedGraph = { edges: new Map(), synonyms: new Map(), labels: new Map() }
      const f = serializeGraph(graph)
      expect(f.edges).toHaveLength(0)
      expect(f.synonyms).toHaveLength(0)
    })
    test('serializeGraph/singleEdge/serialized', () => {
      const graph: ResolvedGraph = {
        edges: new Map([['housing', new Set(['zoning']) as ReadonlySet<string>]]),
        synonyms: new Map(),
        labels: new Map(),
      }
      const f = serializeGraph(graph)
      expect(f.edges).toHaveLength(1)
      expect(f.edges[0]).toMatchObject({ parent: 'housing', child: 'zoning' })
    })
    test('serializeGraph/synonymWithVariants/serialized', () => {
      const graph: ResolvedGraph = {
        edges: new Map(),
        synonyms: new Map([
          ['public-transportation', 'public-transit'],
          ['transit', 'public-transit'],
          ['public-transit', 'public-transit'],
        ]),
        labels: new Map(),
      }
      const f = serializeGraph(graph)
      const group = f.synonyms.find(s => s.canonical === 'public-transit')
      expect(group).toBeDefined()
      expect(group!.variants).toContain('public-transportation')
      expect(group!.variants).toContain('transit')
    })
    test('serializeGraph/roundtripSchemaValid', () => {
      const graph: ResolvedGraph = {
        edges: new Map([['housing', new Set(['zoning']) as ReadonlySet<string>]]),
        synonyms: new Map([['homes', 'housing'], ['housing', 'housing']]),
        labels: new Map([['housing', 'Housing']]),
      }
      const f = serializeGraph(graph)
      expect(() => TaxonomyFileSchema.parse(f)).not.toThrow()
    })
  })
}

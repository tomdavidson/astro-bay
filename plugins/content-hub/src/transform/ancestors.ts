// src/transform/ancestors.ts
import type { EntryTransform, NormalizedEntry } from '../types.ts'
import { slugifyTopic } from '../taxonomy.ts'

// --- Type guards for the optional astro-taxonomy peer ---

type AncestorNode = {
  readonly slug: string
  readonly label: string
}

type AncestorFn = (slug: string) => ReadonlyArray<AncestorNode>

type TaxonomyGraphModule = {
  readonly edges: ReadonlyArray<unknown>
  readonly ancestors: AncestorFn
}

const isAncestorFn = (value: unknown): value is AncestorFn =>
  typeof value === 'function'

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isTaxonomyGraphModule = (value: unknown): value is TaxonomyGraphModule => {
  if (!isObjectRecord(value)) return false
  return Array.isArray(value['edges']) && isAncestorFn(value['ancestors'])
}

// --- Expansion logic (pure) ---

const expandWithAncestors = (
  topics: ReadonlyArray<string>,
  ancestors: AncestorFn,
): ReadonlyArray<string> => [
    ...new Set([
      ...topics,
      ...topics.flatMap(topic =>
        ancestors(slugifyTopic(topic)).map(ancestor => ancestor.slug)
      ),
    ]),
  ]

// --- Public API ---

/**
 * Attempts to load the astro-taxonomy graph module.
 * Returns undefined when the peer is not installed or the graph
 * has no edges (no hierarchy to expand).
 *
 * Uses `.catch(() => undefined)` for the dynamic import — the
 * peer may not be installed.
 */
export const loadTaxonomyGraph = async (): Promise<TaxonomyGraphModule | undefined> => {
  // @ts-expect-error optional peer, may not be installed
  const mod: unknown = await import('astro-taxonomy:graph').catch(() => undefined)
  if (!isTaxonomyGraphModule(mod)) return undefined
  if (mod.edges.length === 0) return undefined
  return mod
}

/**
 * Builds an EntryTransform that expands resolvedTopics with
 * ancestor slugs from the taxonomy graph.
 *
 * Returns undefined when astro-taxonomy is absent or the graph
 * contains no edges. The caller (hub-data.ts) conditionally
 * appends the transform only when defined.
 *
 * topics is never mutated. resolvedTopics receives the union of
 * authored topics and all ancestor slugs.
 */
export const buildAncestorExpansionTransform = async (): Promise<EntryTransform | undefined> => {
  const mod = await loadTaxonomyGraph()
  if (mod === undefined) return undefined

  return (entry: NormalizedEntry): NormalizedEntry => ({
    ...entry,
    resolvedTopics: expandWithAncestors(entry.topics, mod.ancestors),
  })
}
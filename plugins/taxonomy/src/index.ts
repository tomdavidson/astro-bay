// Public API barrel. Import from 'astro-taxonomy' for the integration entry.
// Pure utilities are exported for consumers building on top of the graph.

export { default } from './integration.ts'
export { mergeConfig } from './config.ts'
export { slugifyTopic } from './slugify.ts'
export { composeFragments } from './compose.ts'
export { emptyGraph, mergeFragment, detectCycle, ancestors, children, canonicalize, labelFor } from './graph.ts'
export { buildCoOccurrenceMatrix, topCoOccurrences } from './cooccurrence.ts'
export type {
  TaxonomyEdge,
  SynonymGroup,
  TaxonomyFragment,
  ResolvedGraph,
  TaxonomyContext,
  TaxonomyProvider,
  TaxonomyError,
} from './types.ts'
export type { TaxonomyOptions, ResolvedConfig } from './config.ts'
export type { ProviderResult } from './compose.ts'
export type { CoOccurrenceEntry, CoOccurrenceMatrix } from './cooccurrence.ts'

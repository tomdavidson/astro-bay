// Public API barrel. Import from 'astro-taxonomy' for the integration entry.
// Pure utilities are exported for consumers building on top of the graph.

export { composeFragments } from './compose.ts'
export type { ProviderResult } from './compose.ts'
export { mergeConfig } from './config.ts'
export type { ResolvedConfig, TaxonomyOptions } from './config.ts'
export { buildCoOccurrenceMatrix, topCoOccurrences } from './cooccurrence.ts'
export type { CoOccurrenceEntry, CoOccurrenceMatrix } from './cooccurrence.ts'
export {
  ancestors,
  canonicalize,
  children,
  detectCycle,
  emptyGraph,
  labelFor,
  mergeFragment,
} from './graph.ts'
export { default } from './integration.ts'
export { slugifyTopic } from './slugify.ts'
export type {
  ResolvedGraph,
  SynonymGroup,
  TaxonomyContext,
  TaxonomyEdge,
  TaxonomyError,
  TaxonomyFragment,
  TaxonomyProvider,
} from './types.ts'

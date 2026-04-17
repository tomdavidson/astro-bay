import type { CoOccurrenceEntry as CoEntry } from '../cooccurrence.ts'
import type {
  ResolvedGraph,
  SynonymGroup,
  TaxonomyEdge,
  TaxonomyFragment,
} from '../types.ts'

export const buildEdge = (overrides?: Partial<TaxonomyEdge>): TaxonomyEdge => ({
  parent: 'parent-topic',
  child: 'child-topic',
  confidence: 0.8,
  source: 'derived',
  ...overrides,
})

export const buildSynonymGroup = (overrides?: Partial<SynonymGroup>): SynonymGroup => ({
  canonical: 'public-transit',
  variants: ['public-transportation'],
  confidence: 0.9,
  source: 'curated',
  ...overrides,
})

export const buildFragment = (overrides?: Partial<TaxonomyFragment>): TaxonomyFragment => ({
  edges: [],
  synonyms: [],
  ...overrides,
})

export const buildGraph = (overrides?: Partial<ResolvedGraph>): ResolvedGraph => ({
  edges: new Map(),
  synonyms: new Map(),
  labels: new Map(),
  ...overrides,
})

export const buildCoEntry = (overrides?: Partial<CoEntry>): CoEntry => ({
  topics: ['housing', 'zoning'],
  ...overrides,
})

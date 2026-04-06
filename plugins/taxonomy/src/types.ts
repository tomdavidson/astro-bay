// Shared domain types. No logic, no imports from this package.

export type TaxonomyEdge = {
  readonly parent: string
  readonly child: string
  readonly confidence?: number
  readonly signals?: ReadonlyArray<string>
  readonly source?: 'derived' | 'curated' | 'external'
}

export type SynonymGroup = {
  readonly canonical: string
  readonly variants: ReadonlyArray<string>
  readonly confidence?: number
  readonly source?: 'derived' | 'curated' | 'external'
}

export type TaxonomyFragment = {
  readonly edges: ReadonlyArray<TaxonomyEdge>
  readonly synonyms: ReadonlyArray<SynonymGroup>
  readonly rejections?: ReadonlyArray<{ readonly parent: string; readonly child: string }>
}

export type ResolvedGraph = {
  readonly edges: ReadonlyMap<string, ReadonlySet<string>>
  readonly synonyms: ReadonlyMap<string, string>
  readonly labels: ReadonlyMap<string, string>
}

export type TaxonomyContext = {
  readonly allTopics: ReadonlyArray<string>
  readonly topicLabels: ReadonlyMap<string, string>
}

export type TaxonomyProvider = {
  readonly name: string
  load: (ctx: TaxonomyContext) => Promise<TaxonomyFragment>
  save?: (graph: ResolvedGraph, ctx: TaxonomyContext) => Promise<void>
  readonly watchPaths?: ReadonlyArray<string>
}

export type TaxonomyError =
  | { readonly type: 'CycleDetected'; readonly path: ReadonlyArray<string> }
  | { readonly type: 'ProviderFailed'; readonly provider: string; readonly cause: unknown }
  | { readonly type: 'InvalidFragment'; readonly provider: string; readonly message: string }
  | { readonly type: 'FileNotFound'; readonly path: string }
  | { readonly type: 'ParseError'; readonly path: string; readonly message: string }

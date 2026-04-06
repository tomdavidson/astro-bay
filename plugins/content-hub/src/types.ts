// Core domain types. All readonly where values are part of the domain model.
// Intentional exception: TransformContext.cache is mutable by design so
// transforms can batch and deduplicate work across entries within one build.

export type NormalizedEntry = {
  readonly uid: string
  readonly sourceId: string
  readonly collectionName: string
  readonly title: string
  readonly topics: ReadonlyArray<string>
  readonly resolvedTopics: ReadonlyArray<string>
  readonly aliases: ReadonlyArray<string>
  readonly date: Date | undefined
  readonly draft: boolean
  readonly excerpt: string | undefined
  readonly source: 'vault' | 'feed' | 'custom'
  readonly link: string | undefined
  readonly meta: Readonly<Record<string, unknown>>
}

export type TransformContext = {
  readonly allEntries: ReadonlyArray<NormalizedEntry>
  readonly siteUrl: string
  readonly cache: ReadonlyMap<string, unknown>
}

export type EntryTransform = (
  entry: NormalizedEntry,
  ctx: TransformContext,
) => NormalizedEntry | Promise<NormalizedEntry>

export type TransformWarning = {
  readonly uid: string
  readonly cause: unknown
}

export type TransformResult = {
  readonly entry: NormalizedEntry
  readonly warnings: ReadonlyArray<TransformWarning>
}

export type TransformBatchResult = {
  readonly entries: ReadonlyArray<NormalizedEntry>
  readonly warnings: ReadonlyArray<TransformWarning>
}

export type HubData = {
  readonly raw: ReadonlyArray<NormalizedEntry>
  readonly transformed: ReadonlyArray<NormalizedEntry>
  readonly published: ReadonlyArray<NormalizedEntry>
  readonly topicMap: ReadonlyMap<string, string>
  readonly grouped: ReadonlyMap<string, ReadonlyArray<NormalizedEntry>>
  readonly uidMap: ReadonlyMap<string, NormalizedEntry>
}

export type DraftConfig = {
  readonly showInDev?: boolean
}

export type AliasRoute = {
  readonly alias: string
  readonly uid: string
}

export type TopicWithCount = {
  readonly slug: string
  readonly label: string
  readonly count: number
}

export type PageSlice<T> = {
  readonly entries: ReadonlyArray<T>
  readonly currentPage: number
  readonly totalPages: number
  readonly totalEntries: number
  readonly hasPrev: boolean
  readonly hasNext: boolean
  readonly prevPage: number | undefined
  readonly nextPage: number | undefined
}

export type ContentHubError =
  | {
    readonly type: 'UidCollision'
    readonly collisions: ReadonlyArray<{
      readonly uid: string
      readonly sources: ReadonlyArray<string>
    }>
  }
  | {
    readonly type: 'AliasCollision'
    readonly collisions: ReadonlyArray<{
      readonly alias: string
      readonly owners: ReadonlyArray<string>
    }>
  }
  | {
    readonly type: 'RouteConflict'
    readonly route: string
    readonly hubs: ReadonlyArray<string>
  }
  | {
    readonly type: 'MissingSite'
    readonly context: string
  }
  | {
    readonly type: 'TransformError'
    readonly transform: string
    readonly uid: string
    readonly cause: unknown
  }
  | {
    readonly type: 'ConfigInvalid'
    readonly message: string
  }
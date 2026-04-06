export type JsonLdNode = {
  readonly '@type': string | ReadonlyArray<string>
  readonly '@id': string
  readonly [key: string]: unknown
}

export type RouteJsonLd = {
  readonly route: string
  readonly node: JsonLdNode
  readonly members?: ReadonlyArray<JsonLdNode>
}

export type JsonLdProvider = {
  readonly name: string
  readonly provide: () => Promise<ReadonlyArray<RouteJsonLd>>
}

export type TypeRegistration = {
  readonly rdfType: string
  readonly containerPath: string
  readonly label: string
}

export type LdesMember = {
  readonly type: 'Create' | 'Update' | 'Delete'
  readonly objectId: string
  readonly timestamp: string
}

export type LdesConfig = {
  readonly enabled: boolean
  readonly path: string
  readonly stateFile: string
}

export type JsonLdError =
  | { readonly type: 'DuplicateRoute'; readonly route: string; readonly providers: ReadonlyArray<string> }
  | { readonly type: 'InvalidNode'; readonly route: string; readonly reason: string }
  | { readonly type: 'MissingId'; readonly route: string }
  | { readonly type: 'LdesStateCorrupt'; readonly path: string }

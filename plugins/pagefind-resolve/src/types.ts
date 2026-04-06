// Shared domain types. No logic, no imports from this package.

export type PagefindResult = {
  readonly url: string
  readonly score: number
  readonly title: string
  readonly excerpt?: string
}

export type ResolutionResult =
  | { readonly status: 'redirect'; readonly url: string; readonly score: number; readonly title: string }
  | { readonly status: 'suggestions'; readonly results: ReadonlyArray<PagefindResult> }
  | { readonly status: 'no-results' }

/**
 * The detail payload carried by the `pfr:resolve` CustomEvent.
 * Covers all three resolution outcomes via discriminated union.
 *
 * Usage:
 *   document.addEventListener('pfr:resolve', (e: PfrResolveEvent) => {
 *     console.log(e.detail)
 *   })
 */
export type PfrResolveDetail =
  | {
    readonly event: 'pagefind-resolve.redirect'
    readonly from: string
    readonly to: string
    readonly score: number
    readonly query: string
    readonly title: string
    readonly timestamp: string
  }
  | {
    readonly event: 'pagefind-resolve.suggestions'
    readonly from: string
    readonly query: string
    readonly count: number
    readonly topScore: number
    readonly timestamp: string
  }
  | {
    readonly event: 'pagefind-resolve.no-results'
    readonly from: string
    readonly query: string
    readonly timestamp: string
  }

/** Typed CustomEvent for `pfr:resolve`. */
export type PfrResolveEvent = CustomEvent<PfrResolveDetail>

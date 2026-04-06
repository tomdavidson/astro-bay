// contentDerivedProvider: at build time reads an already-derived file (fast, deterministic).
// The derive step is performed by the CLI script, not by this provider.
// This keeps builds reproducible regardless of content changes between derive runs.

import type { TaxonomyProvider } from '../types.ts'
import { fileProvider } from './file.ts'

export type ContentDerivedProviderOptions = {
  readonly output: string
}

// At build time this behaves identically to fileProvider(output, { optional: true }).
// The file is absent on first-run before a derive pass has been executed.
export const contentDerivedProvider = (
  options: ContentDerivedProviderOptions,
): TaxonomyProvider => ({
  ...fileProvider({ path: options.output, optional: true }),
  name: `content-derived:${options.output}`,
  watchPaths: [options.output],
})

// Astro integration entry — imperative shell only.
// All domain logic lives in pure modules. No business logic here.

import type { AstroIntegration } from 'astro'
import { composeFragments, type ProviderResult } from './compose.ts'
import { mergeConfig, type TaxonomyOptions } from './config.ts'
import { emptyGraph } from './graph.ts'
import type { ResolvedGraph, TaxonomyContext, TaxonomyProvider } from './types.ts'
import { makeVirtualModulePlugin } from './virtual.ts'

export default function astroTaxonomy(options?: TaxonomyOptions): AstroIntegration {
  const resolved = mergeConfig(options)
  let graph: ResolvedGraph = emptyGraph()

  const getGraph = () => graph

  return {
    name: 'astro-taxonomy',
    hooks: {
      'astro:config:setup'({ updateConfig, addWatchFile, logger, command }) {
        updateConfig({ vite: { plugins: [makeVirtualModulePlugin(resolved.virtualModule, getGraph)] } })

        if (command === 'dev') {
          for (const provider of resolved.providers) {
            for (const watchPath of provider.watchPaths ?? []) {
              try {
                addWatchFile(new URL(watchPath, import.meta.url))
              } catch {
                // watchPath is absolute or relative to cwd — pass as URL string
                addWatchFile(new URL(`file://${watchPath}`))
              }
            }
          }
        }

        if (resolved.providers.length === 0) {
          logger.warn('[astro-taxonomy] No providers configured. Graph will be empty.')
        }
      },

      'astro:config:done'({ injectTypes }) {
        injectTypes({
          filename: 'taxonomy.d.ts',
          content: `declare module '${resolved.virtualModule}' {
  import type { ResolvedGraph } from 'astro-taxonomy/types'
  export const edges: Map<string, Set<string>>
  export const synonyms: Map<string, string>
  export const labels: Map<string, string>
  export const graph: ResolvedGraph
  export default graph
}`,
        })
      },

      async 'astro:build:start'({ logger }) {
        await loadProviders(resolved.providers, logger)
      },

      async 'astro:server:setup'({ logger }) {
        await loadProviders(resolved.providers, logger)
      },
    },
  }

  async function loadProviders(
    providers: ReadonlyArray<TaxonomyProvider>,
    logger: { warn: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void },
  ): Promise<void> {
    const ctx: TaxonomyContext = {
      // Context is empty here — content collections aren't available at this hook.
      // Consumers that need content-derived taxonomy should run the derive CLI script
      // to pre-compute and write a file, then use fileProvider or contentDerivedProvider.
      allTopics: [],
      topicLabels: new Map(),
    }

    const providerResults: ProviderResult[] = []
    for (const provider of providers) {
      try {
        const fragment = await provider.load(ctx)
        providerResults.push({ name: provider.name, fragment })
      } catch (e) {
        const msg = `[astro-taxonomy] Provider "${provider.name}" failed: ${String(e)}`
        if (resolved.strict) throw new Error(msg)
        logger.warn(msg)
      }
    }

    const result = composeFragments(providerResults)
    if (result.isOk()) {
      graph = result.value
      logger.info(`[astro-taxonomy] Graph loaded: ${graph.edges.size} edges, ${graph.synonyms.size} synonyms`)
    } else {
      const msg = `[astro-taxonomy] Cycle detected: ${result.error.path.join(' → ')}`
      if (resolved.strict) throw new Error(msg)
      logger.error(msg)
    }
  }
}

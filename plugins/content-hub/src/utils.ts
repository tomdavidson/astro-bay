// Public re-exports for custom pages, feed generation, and sitemap logic.
// This is the stable consumer-facing surface of astro-content-hub/utils.

export {
    aggregateEntries,
    filterPublished,
    normalizeEntry,
    sortByDate,
} from './aggregate.ts'

export {
    entriesForTopic,
    buildTopicMap,
    groupByTopic,
    slugifyTopic,
    topicsWithCounts,
} from './taxonomy.ts'

export {
    collectAliasRoutes,
    detectCollisions,
} from './permalinks.ts'

export { paginate } from './paginate.ts'
export { clearHubCache, getHubData } from './infra/hub-data.ts'

import { runTransforms as runTransformsInternal } from './transform/pipeline.ts'
import type {
    EntryTransform,
    NormalizedEntry,
    TransformBatchResult,
    TransformContext,
} from './types.ts'

// --- RSS helpers ---

export type RssItem = {
    readonly title: string
    readonly pubDate: Date | undefined
    readonly link: string
    readonly description: string
    readonly categories: ReadonlyArray<string>
}

/**
 * Maps a NormalizedEntry to the shape expected by @astrojs/rss `items[]`.
 * Uses `entry.topics` (authored only), never `resolvedTopics`, so ancestor
 * slugs don't leak into outgoing feeds.
 */
export const toRssItem = (
    entry: NormalizedEntry,
    articleBase: string,
): RssItem => ({
    title: entry.title,
    pubDate: entry.date,
    link: `/${articleBase}/${entry.uid}`,
    description: entry.excerpt ?? '',
    categories: [...entry.topics],
})

/**
 * Batch converter for @astrojs/rss: filters out drafts and feed-origin
 * entries (to avoid re-syndication), then maps the rest to RssItem objects.
 */
export const toFeedItems = (
    entries: ReadonlyArray<NormalizedEntry>,
    articleBase: string,
): ReadonlyArray<RssItem> =>
    entries
        .filter((e) => !e.draft && e.source !== 'feed')
        .map((e) => toRssItem(e, articleBase))

export type { TransformBatchResult, TransformWarning } from './types.ts'

// Backward-compatible wrapper returns only the transformed entries array.
// Consumers that do not need warnings use this.
export const runTransforms = async (
    entries: ReadonlyArray<NormalizedEntry>,
    transforms: ReadonlyArray<EntryTransform>,
    ctx: TransformContext,
): Promise<ReadonlyArray<NormalizedEntry>> => {
    const result = await runTransformsInternal(entries, transforms, ctx)
    return result.entries
}

// Detailed variant returns both entries and warnings so callers can surface
// transform failures in logs or UI.
export const runTransformsDetailed = (
    entries: ReadonlyArray<NormalizedEntry>,
    transforms: ReadonlyArray<EntryTransform>,
    ctx: TransformContext,
): Promise<TransformBatchResult> =>
    runTransformsInternal(entries, transforms, ctx)
import { match } from 'ts-pattern'
import type { ResolvedConfig } from '../config.ts'
import { aggregateEntries, filterPublished, type RawEntry } from '../aggregate.ts'
import { detectCollisions } from '../permalinks.ts'
import { buildTopicMap, groupByTopic } from '../taxonomy.ts'
import { buildAncestorExpansionTransform } from '../transform/ancestors.ts'
import { runTransforms } from '../transform/pipeline.ts'
import type {
  HubData,
  NormalizedEntry,
  TransformContext,
  TransformWarning,
} from '../types.ts'
import { getTransforms } from './integration.ts'



type GetCollection = (name: string) => Promise<ReadonlyArray<RawEntry>>
type Logger = { readonly warn: (msg: string) => void; readonly info: (msg: string) => void }
type RuntimeContext = { readonly logger: Logger; readonly command: string }
type AggregatedEntry = { readonly entry: NormalizedEntry; readonly uidFallback: boolean }



// Module-level cache: one Node process = one Astro build.
const hubCache = new Map<string, HubData>()
const getCachedHubData = (name: string): HubData | undefined => hubCache.get(name)



type HubConfig = Omit<ResolvedConfig, 'transforms'> & { readonly transforms?: ReadonlyArray<ResolvedConfig['transforms'][number]> }

const aggregateHubEntries = (
  config: HubConfig,
  getCollection: GetCollection,
): Promise<ReadonlyArray<AggregatedEntry>> =>
  aggregateEntries(
    config.collections,
    getCollection,
    { topics: config.taxonomy.field, feedCategory: config.taxonomy.feedCategoryField },
  )



const warnOnUidFallbacks = (
  config: HubConfig,
  entries: ReadonlyArray<AggregatedEntry>,
  logger: Logger,
): void => {
  entries
    .filter((item) => item.uidFallback)
    .forEach(({ entry }) => {
      logger.warn(
        `astro-content-hub [${config.name}]: entry/${entry.sourceId}/${entry.uid} has no uid field — using entry id. Add uid to silence this warning.`,
      )
    })
}



const warnOnTransformErrors = (
  warnings: ReadonlyArray<TransformWarning>,
  logger: Logger,
): void => {
  warnings.forEach((warning) => {
    logger.warn(
      `astro-content-hub: transform error for entry "${warning.uid}": ${String(warning.cause)}. Using original entry.`,
    )
  })
}



const getAllTransforms = async (
  config: HubConfig,
): Promise<ReadonlyArray<ResolvedConfig['transforms'][number]>> => {
  const registryTransforms = getTransforms(config.name)
  const ancestorTransform = await buildAncestorExpansionTransform()

  const combined = [...(config.transforms ?? []), ...registryTransforms]

  return ancestorTransform === undefined
    ? combined
    : [...combined, ancestorTransform]
}



const transformEntries = async (
  config: HubConfig,
  raw: ReadonlyArray<NormalizedEntry>,
  logger: Logger,
): Promise<ReadonlyArray<NormalizedEntry>> => {
  const transforms = await getAllTransforms(config)
  const ctx: TransformContext = {
    allEntries: raw,
    siteUrl: config.siteUrl,
    cache: new Map(),
  }
  const result = await runTransforms(raw, transforms, ctx)
  warnOnTransformErrors(result.warnings, logger)
  return result.entries
}



const markDraftPreview = (entry: NormalizedEntry): NormalizedEntry =>
  entry.draft
    ? { ...entry, meta: { ...entry.meta, isDraftPreview: true } }
    : entry



const selectPublishedEntries = (
  transformed: ReadonlyArray<NormalizedEntry>,
  config: HubConfig,
  command: string,
): ReadonlyArray<NormalizedEntry> => {
  const includeDrafts = command === 'dev' && config.drafts.showInDev
  return includeDrafts
    ? transformed.map(markDraftPreview)
    : filterPublished(transformed)
}



const assertNoUidCollisions = (
  config: HubConfig,
  published: ReadonlyArray<NormalizedEntry>,
): void => {
  const collisionResult = detectCollisions(published)
  if (collisionResult.isOk()) return

  match(collisionResult.error)
    .with({ type: 'UidCollision' }, (error) => {
      const first = error.collisions[0]
      const uid = first?.uid ?? 'unknown'
      const sources = first?.sources ?? []
      const sourceList = sources.length > 0 ? sources.join(', ') : 'unknown sources'

      throw new Error(
        `astro-content-hub [${config.name}]: UID collision "${uid}" in sources: ${sourceList}. Each entry must have a unique uid.`,
      )
    })
    .exhaustive()
}


const buildHubData = (
  raw: ReadonlyArray<NormalizedEntry>,
  transformed: ReadonlyArray<NormalizedEntry>,
  published: ReadonlyArray<NormalizedEntry>,
): HubData => ({
  raw,
  transformed,
  published,
  topicMap: buildTopicMap(published),
  grouped: groupByTopic(published),
  uidMap: new Map(published.map((entry) => [entry.uid, entry])),
})



export const getHubData = async (
  config: HubConfig,
  getCollection: GetCollection,
  runtime: RuntimeContext,
): Promise<HubData> => {
  const cached = getCachedHubData(config.name)
  if (cached !== undefined) return cached

  const withMeta = await aggregateHubEntries(config, getCollection)
  warnOnUidFallbacks(config, withMeta, runtime.logger)

  const raw = withMeta.map((item) => item.entry)
  const transformed = await transformEntries(config, raw, runtime.logger)
  const published = selectPublishedEntries(transformed, config, runtime.command)

  assertNoUidCollisions(config, published)

  const data = buildHubData(raw, transformed, published)
  hubCache.set(config.name, data)
  return data
}



/** Clears the runtime cache. Called by the Astro integration on startup. */
export const clearHubCache = (): void => {
  hubCache.clear()
}
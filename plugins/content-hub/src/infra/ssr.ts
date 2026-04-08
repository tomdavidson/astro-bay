import type { HubData, NormalizedEntry, PageSlice } from '../types.ts';
import type { ResolvedConfig } from '../config.ts';
import { paginate } from '../paginate.ts';
import { getHubData as getHubDataInternal } from './hub-data.ts';

// Narrow the getCollection and runtime types directly from getHubData.
type GetCollection = Parameters<typeof getHubDataInternal>[1];
type RuntimeContext = Parameters<typeof getHubDataInternal>[2];

const buildRuntime = (command: string): RuntimeContext => ({
  logger: {
    warn: (msg: string): void => console.warn(msg),
    info: (msg: string): void => console.warn(`INFO: ${msg}`),
  },
  command,
});

const resolveHubData = async (
  config: ResolvedConfig,
  getCollection: GetCollection,
  command = 'build',
): Promise<HubData> => getHubDataInternal(config, getCollection, buildRuntime(command));

/**
 * Look up a single article by UID from the published set.
 * Returns undefined when the UID is unknown or the entry is a draft
 * that is not visible under the current command/config.
 */
export const getArticleByUid = async (
  config: ResolvedConfig,
  getCollection: GetCollection,
  uid: string,
  command?: string,
): Promise<NormalizedEntry | undefined> => {
  const data = await resolveHubData(config, getCollection, command);
  return data.uidMap.get(uid);
};

/**
 * Return a paginated slice of entries for a topic slug.
 *
 * - Returns undefined when the topic has no published entries.
 * - Page numbers are 1-based and clamped by the same paginate() utility
 *   used at build time, so out-of-range values snap to the nearest page.
 */
export const getTopicSlice = async (
  config: ResolvedConfig,
  getCollection: GetCollection,
  slug: string,
  page: number,
  pageSize?: number,
  command?: string,
): Promise<PageSlice<NormalizedEntry> | undefined> => {
  const data = await resolveHubData(config, getCollection, command);
  const entries = data.grouped.get(slug);
  if (entries === undefined) return undefined;
  return paginate(entries, page, pageSize ?? config.browse.pageSize);
};

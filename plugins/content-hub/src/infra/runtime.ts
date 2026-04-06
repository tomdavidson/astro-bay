// Consumer-facing convenience wrapper. Runs inside Astro pages/endpoints only.
import rawConfig from 'astro-content-hub:config'
import { getCollection as rawGetCollection } from 'astro:content'
import { getHubData as getHubDataInternal } from './hub-data.ts'
import type { HubData } from '../types.ts'
import type { ResolvedConfig } from '../config.ts'

const isResolvedConfigWithCommand = (value: unknown): value is ResolvedConfig & { readonly astroCommand: string } => {
  if (typeof value !== 'object' || value === null) return false
  if (!('astroCommand' in value)) return false
  const v = value as { readonly astroCommand?: unknown }
  return typeof v.astroCommand === 'string'
}

type GetCollectionArg = Parameters<typeof getHubDataInternal>[1]

const isGetCollection = (fn: unknown): fn is GetCollectionArg =>
  typeof fn === 'function'

if (!isResolvedConfigWithCommand(rawConfig)) {
  throw new Error('astro-content-hub runtime: invalid config injected')
}
const config: ResolvedConfig & { readonly astroCommand: string } = rawConfig

if (!isGetCollection(rawGetCollection)) {
  throw new Error('astro-content-hub runtime: invalid getCollection injected')
}
const getCollection: GetCollectionArg = rawGetCollection

const logger = {
  warn: (msg: string): void => console.warn(msg),
  info: (msg: string): void => console.warn(`INFO: ${msg}`),
}

const runtime = {
  logger,
  command: config.astroCommand,
}

export const getHubData = (): Promise<HubData> =>
  getHubDataInternal(config, getCollection, runtime)

export { config }
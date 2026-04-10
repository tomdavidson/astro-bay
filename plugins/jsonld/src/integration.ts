/* eslint-disable functional/no-return-void, functional/no-expression-statements, functional/no-throw-statements, functional/no-loop-statements */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { AstroIntegration } from 'astro'
import { match } from 'ts-pattern'

import { type JsonLdOptions, mergeConfig, type ResolvedConfig } from './config.ts'
import { buildState, diffState, parseState, serializeChangeFeed, serializeState } from './ldes.domain.ts'
import { serializeAll } from './serializer.domain.ts'
import { buildTypeIndex } from './type-index.domain.ts'
import type { JsonLdError, RouteJsonLd } from './types.ts'
import { validateAll } from './validation.domain.ts'

type Logger = {
  readonly debug: (msg: string) => void
  readonly info: (msg: string) => void
  readonly warn: (msg: string) => void
  readonly error: (msg: string) => void
}

const logError =
  (logger: Logger) =>
    (e: JsonLdError): void =>
    match(e)
      .with({ type: 'DuplicateRoute' }, v => logger.error(`Duplicate route: ${v.route}`))
      .with({ type: 'InvalidNode' }, v => logger.error(`Invalid node at ${v.route}`))
      .with({ type: 'MissingId' }, v => logger.error(`Missing @id at ${v.route}`))
      .with({ type: 'LdesStateCorrupt' }, v => logger.error(`LDES state corrupt: ${v.path}`))
      .exhaustive()

const collectRoutes = async (
  providers: ReadonlyArray<{ readonly provide: () => Promise<ReadonlyArray<RouteJsonLd>> }>,
): Promise<ReadonlyArray<RouteJsonLd>> => {
  const results = await Promise.all(providers.map(p => p.provide()))
  return results.flat()
}

const writeJsonLdFiles = async (
  dir: string,
  serialized: ReadonlyArray<{ readonly filename: string; readonly content: string }>,
  logger: Logger,
): Promise<void> => {
  await Promise.all(
    serialized.map(async file => {
      const outPath = join(dir, file.filename)
      await mkdir(dirname(outPath), { recursive: true })
      await writeFile(outPath, file.content, 'utf-8')
      logger.debug(`wrote ${file.filename}`)
    }),
  )
}

const loadPreviousState = async (
  stateFilePath: string,
  logger: Logger,
): Promise<ReadonlyMap<string, string>> => {
  const raw = await readFile(stateFilePath, 'utf-8').catch(() => {})

  if (raw === undefined) {
    logger.info('No previous LDES state, treating as first build')
    return new Map()
  }

  const parsed = parseState(raw)

  if (parsed.isErr()) {
    logger.warn('LDES state file corrupt, treating as first build')
    return new Map()
  }

  return parsed.value
}

type LdesFeedOptions = {
  readonly dir: string
  readonly resolved: { readonly site: string; readonly context: Record<string, string>; readonly ldes: { readonly path: string; readonly stateFile: string } }
  readonly allRoutes: ReadonlyArray<RouteJsonLd>
  readonly logger: Logger
}

const writeLdesFeed = async ({ dir, resolved, allRoutes, logger }: LdesFeedOptions): Promise<void> => {
  const currentState = buildState(allRoutes)
  const stateFilePath = join(dir, '..', resolved.ldes.stateFile)
  const previousState = await loadPreviousState(stateFilePath, logger)
  const timestamp = new Date().toISOString()
  const members = diffState(previousState, currentState, timestamp)

  if (members.length > 0) {
    const feed = serializeChangeFeed(resolved.site, resolved.context, members)
    const feedPath = join(dir, resolved.ldes.path)
    await mkdir(dirname(feedPath), { recursive: true })
    await writeFile(feedPath, feed, 'utf-8')
    logger.info(`wrote ${resolved.ldes.path} (${members.length} changes)`)
  }

  await writeFile(stateFilePath, serializeState(currentState), 'utf-8')
}

const validateRoutes = (allRoutes: ReadonlyArray<RouteJsonLd>, logger: Logger): void => {
  const result = validateAll(allRoutes)

  if (result.isErr()) {
    for (const e of result.error) {
      logError(logger)(e)
    }
    throw new Error('astro-jsonld: validation failed')
  }
}

const writeTypeIndex = async (outDir: string, resolved: ResolvedConfig, logger: Logger): Promise<void> => {
  const typeIndex = buildTypeIndex(resolved.site, resolved.context, resolved.typeRegistrations)
  await writeFile(join(outDir, 'index.jsonld'), typeIndex, 'utf-8')
  logger.info('wrote /index.jsonld (Type Index)')
}

const handleBuildDone = async (
  dir: URL,
  logger: Logger,
  resolved: ResolvedConfig,
): Promise<void> => {
  if (!resolved.site) {
    logger.warn('astro-jsonld: no site URL configured. @id values will be relative.')
  }

  const allRoutes = await collectRoutes(resolved.providers)

  if (resolved.validate) {
    validateRoutes(allRoutes, logger)
  }

  const serialized = serializeAll(resolved.context, allRoutes)
  const outDir = fileURLToPath(dir)
  await writeJsonLdFiles(outDir, serialized, logger)

  if (resolved.typeRegistrations.length > 0) {
    await writeTypeIndex(outDir, resolved, logger)
  }

  if (resolved.ldes.enabled) {
    await writeLdesFeed({ dir: outDir, resolved, allRoutes, logger })
  }

  logger.info(`emitted ${serialized.length} .jsonld files`)
}

export const jsonLd = (options?: JsonLdOptions): AstroIntegration => ({
  name: 'astro-jsonld',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const resolved = mergeConfig(options?.site ?? '', options)
      await handleBuildDone(dir, logger, resolved)
    },
  },
})
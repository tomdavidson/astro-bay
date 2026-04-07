import type { HookParameters } from 'astro'
import { vi } from 'vitest'

type ConfigSetupParams = HookParameters<'astro:config:setup'>
type ConfigDoneParams = HookParameters<'astro:config:done'>
type BuildDoneParams = HookParameters<'astro:build:done'>

export const makeConfigSetupContext = (
  overrides?: Partial<Pick<ConfigSetupParams, 'isRestart' | 'command'>>,
) => {
  const updateConfig = vi.fn()
  const injectRoute = vi.fn()
  const injectScript = vi.fn()
  const addRenderer = vi.fn()
  const addWatchFile = vi.fn()
  const addClientDirective = vi.fn()
  const addDevToolbarApp = vi.fn()
  const addMiddleware = vi.fn()
  const createCodegenDir = vi.fn()
  const info = vi.fn()

  const params = {
    config: {},
    command: overrides?.command ?? 'build',
    isRestart: overrides?.isRestart ?? false,
    updateConfig,
    injectRoute,
    injectScript,
    addRenderer,
    addWatchFile,
    addClientDirective,
    addDevToolbarApp,
    addMiddleware,
    createCodegenDir,
    logger: { info },
  } as unknown as ConfigSetupParams

  return { params, updateConfig, injectRoute, info } as const
}

export const makeConfigDoneContext = (
  overrides?: {
    readonly site?: string | undefined
    readonly buildOutput?: ConfigDoneParams['buildOutput']
  },
) => {
  const injectTypes = vi.fn()
  const setAdapter = vi.fn()
  const info = vi.fn()

  const params = {
    config: { site: overrides?.site },
    setAdapter,
    injectTypes,
    logger: { info },
    buildOutput: overrides?.buildOutput ?? 'static',
  } as unknown as ConfigDoneParams

  return { params, injectTypes, setAdapter, info } as const
}

export const makeBuildDoneContext = () => {
  const info = vi.fn()

  const params = {
    pages: [],
    dir: new URL('file:///tmp/dist/'),
    routes: [],
    assets: new Map(),
    logger: { info },
  } as unknown as BuildDoneParams

  return { params, info } as const
}

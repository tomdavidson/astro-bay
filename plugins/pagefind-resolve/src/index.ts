// Public API barrel.
// Import from 'astro-pagefind-resolve' to access pure core functions and types.

export type { LogLevel, Smart404Config, Smart404Options } from './config'
export type { NoResultsEvent, RedirectEvent, ResolveEvent, SuggestionsEvent } from './logging'
export type { ResolveConfig } from './resolve'
export type { PagefindResult, PfrResolveDetail, PfrResolveEvent, ResolutionResult } from './types'

export { DEFAULTS, mergeConfig } from './config'
export { createNoResultsEvent, createRedirectEvent, createSuggestionsEvent, emitLog } from './logging'
export { pathToQuery } from './path'
export { resolveResults } from './resolve'
export { isConfidentRedirect, reweightResults } from './scoring'
export { scoreUrlMatch, tokenizePath, tokenizeQuery } from './url'

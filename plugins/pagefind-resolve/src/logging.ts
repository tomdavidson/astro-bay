// Structured logging event constructors and emitter.
// Pure data constructors — no console calls in the constructors.
// LogLevel is owned by config.ts; re-exported here for convenience.

export type { LogLevel } from './config'
import type { LogLevel } from './config'
import type { PfrResolveDetail } from './types'

export type RedirectEvent = Extract<PfrResolveDetail, { event: 'pagefind-resolve.redirect' }>
export type SuggestionsEvent = Extract<PfrResolveDetail, { event: 'pagefind-resolve.suggestions' }>
export type NoResultsEvent = Extract<PfrResolveDetail, { event: 'pagefind-resolve.no-results' }>
export type ResolveEvent = PfrResolveDetail

export const createRedirectEvent = (
  from: string,
  to: string,
  score: number,
  query: string,
  title: string,
): RedirectEvent => ({
  event: 'pagefind-resolve.redirect',
  from,
  to,
  score,
  query,
  title,
  timestamp: new Date().toISOString(),
})

export const createSuggestionsEvent = (
  from: string,
  query: string,
  count: number,
  topScore: number,
): SuggestionsEvent => ({
  event: 'pagefind-resolve.suggestions',
  from,
  query,
  count,
  topScore,
  timestamp: new Date().toISOString(),
})

export const createNoResultsEvent = (from: string, query: string): NoResultsEvent => ({
  event: 'pagefind-resolve.no-results',
  from,
  query,
  timestamp: new Date().toISOString(),
})

export const emitLog = (level: LogLevel, event: ResolveEvent): void => {
  if (level === 'silent') return
  const method = level === 'debug' ? console.debug : console.info
  method('[pagefind-resolve]', event)
}

if (import.meta.vitest) {
  const { test, expect, describe, vi } = import.meta.vitest as any

  describe('createRedirectEvent', () => {
    test('createRedirectEvent_setsAllFields', () => {
      const e = createRedirectEvent('/old', '/new', 0.9, 'old slug', 'New Title')
      expect(e.event).toBe('pagefind-resolve.redirect')
      expect(e.from).toBe('/old')
      expect(e.to).toBe('/new')
      expect(e.score).toBe(0.9)
      expect(e.query).toBe('old slug')
      expect(e.title).toBe('New Title')
    })

    test('createRedirectEvent_timestampIsISO', () => {
      const e = createRedirectEvent('/a', '/b', 0.9, 'q', 'T')
      expect(new Date(e.timestamp).toISOString()).toBe(e.timestamp)
    })
  })

  describe('createSuggestionsEvent', () => {
    test('createSuggestionsEvent_setsAllFields', () => {
      const e = createSuggestionsEvent('/old', 'q', 3, 0.7)
      expect(e.event).toBe('pagefind-resolve.suggestions')
      expect(e.count).toBe(3)
      expect(e.topScore).toBe(0.7)
      expect(e.from).toBe('/old')
      expect(e.query).toBe('q')
    })
  })

  describe('createNoResultsEvent', () => {
    test('createNoResultsEvent_setsAllFields', () => {
      const e = createNoResultsEvent('/gone', 'missing')
      expect(e.event).toBe('pagefind-resolve.no-results')
      expect(e.from).toBe('/gone')
      expect(e.query).toBe('missing')
    })
  })

  describe('emitLog', () => {
    test('emitLog_info_callsConsoleInfo', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
      const e = createRedirectEvent('/a', '/b', 0.9, 'q', 'T')
      emitLog('info', e)
      expect(spy).toHaveBeenCalledWith('[pagefind-resolve]', e)
      spy.mockRestore()
    })

    test('emitLog_debug_callsConsoleDebug', () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
      const e = createNoResultsEvent('/a', 'q')
      emitLog('debug', e)
      expect(spy).toHaveBeenCalledWith('[pagefind-resolve]', e)
      spy.mockRestore()
    })

    test('emitLog_silent_logsNothing', () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {})
      const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
      emitLog('silent', createNoResultsEvent('/a', 'q'))
      expect(info).not.toHaveBeenCalled()
      expect(debug).not.toHaveBeenCalled()
      info.mockRestore()
      debug.mockRestore()
    })
  })
}

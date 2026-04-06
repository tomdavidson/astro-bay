/**
 * Browser-side imperative shell.
 * Wires pure resolve logic to the live Pagefind API and DOM.
 * No business logic lives here — all decisions happen in the pure core files.
 *
 * XSS: The only external inputs are:
 *   - window.location.pathname → sanitized by pathToQuery (alphanumeric + spaces only)
 *   - Pagefind excerpt HTML → sanitized by sanitizeExcerpt (allows only <mark> tags)
 *   - Pagefind result URLs → used as href values, never innerHTML
 *   - Pagefind result titles → used as textContent, never innerHTML
 * No unsanitized HTML is ever written to the DOM.
 */

import type { Smart404Config } from '../config'
import { pathToQuery, resolveResults, reweightResults, scoreUrlMatch, tokenizeQuery } from '../index'
import { createNoResultsEvent, createRedirectEvent, createSuggestionsEvent, emitLog } from '../logging'
import type { ResolveConfig } from '../resolve'
import type { PagefindResult } from '../types'
import type { PfrResolveDetail } from '../types'

type PagefindSearchResult = {
  data: () => Promise<{ url: string; meta?: { title?: string }; excerpt?: string }>
  score: number
}

type PagefindResponse = { results: PagefindSearchResult[] }

type PagefindAPI = { search: (query: string) => Promise<PagefindResponse> }

/**
 * Sanitize a Pagefind excerpt for safe DOM insertion.
 * Pagefind wraps matched terms in <mark> tags. We allow only those;
 * all other HTML is stripped to plain text to prevent XSS.
 */
const sanitizeExcerpt = (html: string): DocumentFragment => {
  const template = document.createElement('template')
  // Parse as HTML fragment in a sandboxed template element
  template.innerHTML = html

  const fragment = document.createDocumentFragment()
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)

  let node: Node | null = walker.nextNode()
  while (node !== null) {
    if (node.nodeType === Node.TEXT_NODE) {
      fragment.appendChild(document.createTextNode(node.textContent ?? ''))
    } else if (node instanceof Element && node.tagName.toLowerCase() === 'mark') {
      const mark = document.createElement('mark')
      mark.textContent = node.textContent
      fragment.appendChild(mark)
    }
    node = walker.nextNode()
  }

  return fragment
}

const setText = (el: Element | null, text: string): void => {
  if (el) el.textContent = text
}

const show = (el: Element | null): void => {
  if (el instanceof HTMLElement) el.hidden = false
}

const renderSuggestions = (listEl: Element | null, results: ReadonlyArray<PagefindResult>): void => {
  if (!listEl) return

  listEl.innerHTML = ''
  results.forEach(result => {
    const li = document.createElement('li')
    const a = document.createElement('a')
    a.href = result.url
    a.textContent = result.title

    if (result.excerpt !== undefined) {
      const small = document.createElement('small')
      small.appendChild(sanitizeExcerpt(result.excerpt))
      li.append(a, document.createTextNode(' '), small)
    } else {
      li.appendChild(a)
    }

    listEl.appendChild(li)
  })
  show(listEl)
}

const updateSearchLink = (el: Element | null, searchRoute: string, query: string): void => {
  if (!el) return
  const a = el.querySelector('a')
  if (a) {
    a.href = `${searchRoute}?q=${encodeURIComponent(query)}`
    a.textContent = `search for "${query}"`
  }
  show(el)
}

const dispatchResolveEvent = (root: HTMLElement, detail: PfrResolveDetail): void => {
  root.dispatchEvent(new CustomEvent<PfrResolveDetail>('pfr:resolve', { detail, bubbles: true }))
}

const toResolveConfig = (cfg: Smart404Config): ResolveConfig => ({
  scoreThreshold: cfg.scoreThreshold,
  redirectDominanceFactor: cfg.redirectDominanceFactor,
  maxSuggestions: cfg.maxSuggestions,
  minUrlPathScoreForRedirect: cfg.minUrlPathScoreForRedirect,
})

const hydrateResults = async (
  search: PagefindResponse,
  fetchCount: number,
): Promise<ReadonlyArray<PagefindResult>> =>
  Promise.all(
    search.results.slice(0, fetchCount).map(async result => {
      const data = await result.data()
      const base: PagefindResult = { url: data.url, score: result.score, title: data.meta?.title ?? data.url }
      return data.excerpt === undefined ? base : { ...base, excerpt: data.excerpt }
    }),
  )

const logScoredResults = (
  config: Smart404Config,
  pathname: string,
  query: string,
  hydrated: ReadonlyArray<PagefindResult>,
): void => {
  if (config.logLevel !== 'debug') return

  const queryTokens = tokenizeQuery(query)

  console.debug('[pagefind-resolve]', {
    event: 'pagefind-resolve.scored-results',
    from: pathname,
    query,
    urlPathWeight: config.urlPathWeight,
    minUrlPathScoreForRedirect: config.minUrlPathScoreForRedirect,
    results: hydrated.slice(0, 5).map(result => {
      const pathScore = scoreUrlMatch(queryTokens, result.url)
      return {
        url: result.url,
        title: result.title,
        contentScore: result.score,
        pathScore,
        blendedScore: config.urlPathWeight * pathScore + (1 - config.urlPathWeight) * result.score,
      }
    }),
  })
}

const logRedirectGate = (
  config: Smart404Config,
  pathname: string,
  query: string,
  reweighted: ReadonlyArray<PagefindResult>,
): void => {
  if (config.logLevel !== 'debug') return

  const top = reweighted[0]
  const queryTokens = tokenizeQuery(query)
  const topPathScore = top ? scoreUrlMatch(queryTokens, top.url) : 0

  console.debug('[pagefind-resolve]', {
    event: 'pagefind-resolve.redirect-gate',
    from: pathname,
    query,
    topUrl: top?.url ?? null,
    topScore: top?.score ?? null,
    topPathScore,
    minUrlPathScoreForRedirect: config.minUrlPathScoreForRedirect,
    redirectPathGatePassed: topPathScore >= config.minUrlPathScoreForRedirect,
  })
}

const handleResolution = (
  root: HTMLElement,
  statusEl: Element | null,
  suggestionsEl: Element | null,
  searchLinkEl: Element | null,
  config: Smart404Config,
  query: string,
  pathname: string,
  resolution: ReturnType<typeof resolveResults>,
): void => {
  if (resolution.status === 'redirect') {
    const e = createRedirectEvent(pathname, resolution.url, resolution.score, query, resolution.title)
    emitLog(config.logLevel, e)
    dispatchResolveEvent(root, e)
    window.location.replace(resolution.url)
    return
  }

  if (resolution.status === 'suggestions') {
    const e = createSuggestionsEvent(
      pathname,
      query,
      resolution.results.length,
      resolution.results[0]?.score ?? 0,
    )
    emitLog(config.logLevel, e)
    dispatchResolveEvent(root, e)
    setText(statusEl, 'Page not found. Did you mean one of these?')
    renderSuggestions(suggestionsEl, resolution.results)
    updateSearchLink(searchLinkEl, config.searchRoute, query)
    return
  }

  const e = createNoResultsEvent(pathname, query)
  emitLog(config.logLevel, e)
  dispatchResolveEvent(root, e)
  setText(statusEl, 'Page not found.')
  updateSearchLink(searchLinkEl, config.searchRoute, query)
}

const loadPagefind = async (pagefindPath: string): Promise<PagefindAPI> => {
  const mod = await import(/* @vite-ignore */ pagefindPath)
  return mod as PagefindAPI
}

/**
 * Initialise the 404 resolver for a single component root element.
 * Called from the Resolve404 component's inline script.
 *
 * @param root - The component's root HTMLElement, carrying `data-pfr-config` and `data-pfr-id`.
 */
export const initResolve404 = async (root: HTMLElement): Promise<void> => {
  const config: Smart404Config = JSON.parse(root.dataset.pfrConfig ?? '{}')
  const statusEl = root.querySelector('[data-pfr-status]')
  const suggestionsEl = root.querySelector('[data-pfr-suggestions]')
  const searchLinkEl = root.querySelector('[data-pfr-search-link]')
  const pathname = window.location.pathname
  const query = pathToQuery(pathname, config.stripBases ?? [])

  if (!query) {
    setText(statusEl, 'Page not found.')
    return
  }

  if (config.logLevel === 'debug') {
    console.debug('[pagefind-resolve]', { event: 'pagefind-resolve.search-start', from: pathname, query })
  }

  try {
    const pagefind = await loadPagefind(config.pagefindPath)
    const search = await pagefind.search(query)
    const fetchCount = Math.max(config.maxSuggestions + 1, 2)
    const hydrated = await hydrateResults(search, fetchCount)

    logScoredResults(config, pathname, query, hydrated)

    const reweighted = reweightResults(hydrated, query, config.urlPathWeight)

    logRedirectGate(config, pathname, query, reweighted)

    const resolution = resolveResults(reweighted, query, toResolveConfig(config))
    handleResolution(root, statusEl, suggestionsEl, searchLinkEl, config, query, pathname, resolution)
  } catch (err) {
    if (config.logLevel !== 'silent') {
      console.error('[pagefind-resolve]', {
        event: 'pagefind-resolve.error',
        from: pathname,
        error: String(err),
      })
    }
    setText(statusEl, 'Page not found.')
  }
}

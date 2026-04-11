import { describe, expect, it } from 'vitest'
import { buildEntry, buildEntryWithTopics } from '../test/builders.ts'
import { createContentHubProvider, createTopicsProvider } from './jsonld-provider.ts'

const site = 'https://example.com'
const articleBase = 'articles'
const taxonomyRoute = 'topics'

describe('createContentHubProvider', () => {
  it('returns BlogPosting per entry', async () => {
    const entries = [
      buildEntry({ uid: 'alpha', title: 'Alpha Post' }),
      buildEntry({ uid: 'beta', title: 'Beta Post' }),
    ]
    const provider = createContentHubProvider({ site, articleBase, taxonomyRoute, entries })

    expect(provider.name).toBe('content-hub-articles')

    const routes = await provider.provide()
    const articleRoutes = routes.filter(r => (r.node as Record<string, unknown>)['@type'] === 'BlogPosting')

    expect(articleRoutes).toHaveLength(2)
    expect(articleRoutes[0]!.route).toBe('/articles/alpha/')
    expect((articleRoutes[0]!.node as Record<string, unknown>).headline).toBe('Alpha Post')
    expect(articleRoutes[1]!.route).toBe('/articles/beta/')
  })

  it('collectionPage has correct member count', async () => {
    const entries = [buildEntry({ uid: 'a' }), buildEntry({ uid: 'b' }), buildEntry({ uid: 'c' })]
    const provider = createContentHubProvider({ site, articleBase, taxonomyRoute, entries })
    const routes = await provider.provide()
    const collection = routes.find(r => (r.node as Record<string, unknown>)['@type'] === 'CollectionPage')

    expect(collection).toBeDefined()
    expect(collection!.route).toBe('/articles/')
    expect((collection!.node as Record<string, unknown>).numberOfItems).toBe(3)
    expect(collection!.members).toHaveLength(3)
  })

  it('maps aliases to sameAs', async () => {
    const entries = [buildEntry({ uid: 'post-1', aliases: ['old-slug', 'another-slug'] })]
    const provider = createContentHubProvider({ site, articleBase, taxonomyRoute, entries })
    const routes = await provider.provide()
    const article = routes.find(r => r.route === '/articles/post-1/')

    expect((article!.node as Record<string, unknown>).sameAs).toEqual([
      'https://example.com/articles/old-slug/',
      'https://example.com/articles/another-slug/',
    ])
  })

  it('omits datePublished when entry has no date', async () => {
    const entries = [buildEntry({ uid: 'no-date', date: undefined })]
    const provider = createContentHubProvider({ site, articleBase, taxonomyRoute, entries })
    const routes = await provider.provide()
    const article = routes.find(r => r.route === '/articles/no-date/')

    expect((article!.node as Record<string, unknown>).datePublished).toBeUndefined()
  })

  it('includes datePublished when entry has a date', async () => {
    const date = new Date('2025-06-15T00:00:00Z')
    const entries = [buildEntry({ uid: 'dated', date })]
    const provider = createContentHubProvider({ site, articleBase, taxonomyRoute, entries })
    const routes = await provider.provide()
    const article = routes.find(r => r.route === '/articles/dated/')

    expect((article!.node as Record<string, unknown>).datePublished).toBe(date.toISOString())
  })

  it('maps topics to about references', async () => {
    const entries = [buildEntryWithTopics(['TypeScript', 'Astro'], { uid: 'ts-post' })]
    const provider = createContentHubProvider({ site, articleBase, taxonomyRoute, entries })
    const routes = await provider.provide()
    const article = routes.find(r => r.route === '/articles/ts-post/')
    const about = article!.node.about as ReadonlyArray<{ readonly '@id': string }>

    expect(about).toHaveLength(2)
    expect(about[0]!['@id']).toBe('https://example.com/topics/typescript/')
    expect(about[1]!['@id']).toBe('https://example.com/topics/astro/')
  })
})

describe('createTopicsProvider', () => {
  it('returns DefinedTerm per topic', async () => {
    const topicMap = new Map([['typescript', 'TypeScript'], ['astro', 'Astro']])
    const groupedEntries = new Map([['typescript', [buildEntry({ uid: 'a' }), buildEntry({ uid: 'b' })]], [
      'astro',
      [buildEntry({ uid: 'c' })],
    ]])
    const provider = createTopicsProvider({ site, taxonomyRoute, topicMap, groupedEntries })

    expect(provider.name).toBe('content-hub-topics')

    const routes = await provider.provide()
    const topicRoutes = routes.filter(r => (r.node as Record<string, unknown>)['@type'] === 'DefinedTerm')

    expect(topicRoutes).toHaveLength(2)
    expect(topicRoutes[0]!.route).toBe('/topics/typescript/')
    expect((topicRoutes[0]!.node as Record<string, unknown>).name).toBe('TypeScript')
    expect((topicRoutes[0]!.node as Record<string, unknown>).numberOfItems).toBe(2)
  })

  it('collectionPage lists all topics', async () => {
    const topicMap = new Map([['a', 'A'], ['b', 'B'], ['c', 'C']])
    const groupedEntries = new Map<string, ReadonlyArray<ReturnType<typeof buildEntry>>>()
    const provider = createTopicsProvider({ site, taxonomyRoute, topicMap, groupedEntries })
    const routes = await provider.provide()
    const collection = routes.find(r => (r.node as Record<string, unknown>)['@type'] === 'CollectionPage')

    expect(collection).toBeDefined()
    expect(collection!.route).toBe('/topics/')
    expect((collection!.node as Record<string, unknown>).numberOfItems).toBe(3)
  })

  it('includes skos:inScheme on each topic', async () => {
    const topicMap = new Map([['rust', 'Rust']])
    const groupedEntries = new Map([['rust', [buildEntry({ uid: 'x' })]]])
    const provider = createTopicsProvider({ site, taxonomyRoute, topicMap, groupedEntries })
    const routes = await provider.provide()
    const topic = routes.find(r => r.route === '/topics/rust/')
    const node = topic!.node as Record<string, unknown>

    expect(node['skos:inScheme']).toEqual({ '@id': 'https://example.com/topics/' })
  })
})

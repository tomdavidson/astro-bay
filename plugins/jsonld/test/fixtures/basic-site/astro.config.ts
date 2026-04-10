 
import { defineConfig } from 'astro/config'
import { jsonLd } from '../../../src/integration.ts'

const mockProvider = {
  name: 'mock-articles',
  provide: async () => [
    {
      route: '/articles/',
      node: {
        '@type': 'CollectionPage',
        '@id': 'https://example.com/articles/',
        'name': 'Articles',
        'numberOfItems': 1,
      },
      members: [
        {
          '@type': 'BlogPosting',
          '@id': 'https://example.com/articles/hello/',
          'headline': 'Hello World',
        },
      ],
    },
    {
      route: '/articles/hello/',
      node: {
        '@type': 'BlogPosting',
        '@id': 'https://example.com/articles/hello/',
        'headline': 'Hello World',
        'datePublished': '2026-01-01T00:00:00Z',
      },
    },
  ],
}

export default defineConfig({
  site: 'https://example.com',
  integrations: [
    jsonLd({
      providers: [mockProvider],
      typeRegistrations: [
        {
          rdfType: 'https://schema.org/BlogPosting',
          containerPath: '/articles/',
          label: 'Articles',
        },
      ],
      ldes: { enabled: true },
    }),
  ],
})

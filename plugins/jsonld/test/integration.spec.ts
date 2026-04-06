import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const FIXTURE_DIR = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/basic-site')
const OUT_DIR = join(FIXTURE_DIR, 'dist')

const runE2e = Boolean(process.env['ASTRO_JSONLD_E2E'])

describe.skipIf(!runE2e)('integration: basic-site fixture', () => {
  test('emitsIndexJsonld', () => {
    expect(existsSync(join(OUT_DIR, 'articles', 'index.jsonld'))).toBe(true)
  })

  test('emitsItemJsonld', () => {
    expect(existsSync(join(OUT_DIR, 'articles', 'hello', 'index.jsonld'))).toBe(true)
  })

  test('jsonldContainsAtContext', () => {
    const content = readFileSync(join(OUT_DIR, 'articles', 'hello', 'index.jsonld'), 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed['@context']).toBeDefined()
    expect(parsed['@type']).toBeDefined()
    expect(parsed['@id']).toBeDefined()
  })

  test('emitsLdesChangeFeed', () => {
    expect(existsSync(join(OUT_DIR, 'changes.jsonld'))).toBe(true)
  })

  test('htmlIncludesAlternateLink', () => {
    const html = readFileSync(join(OUT_DIR, 'articles', 'hello', 'index.html'), 'utf-8')
    expect(html).toContain('application/ld+json')
  })
})

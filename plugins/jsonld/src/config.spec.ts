import { describe, expect, test } from 'vitest'
import { mergeConfig } from './config.ts'

describe('mergeConfig', () => {
  test('mergeConfig|noOptions|usesDefaults', () => {
    const result = mergeConfig('https://example.com')
    expect(result.site).toBe('https://example.com')
    expect(result.validate).toBe(true)
    expect(result.ldes.enabled).toBe(true)
    expect(result.context['@vocab']).toBe('https://schema.org/')
  })

  test('mergeConfig|withSiteOption|overridesSite', () => {
    const result = mergeConfig('https://fallback.com', { site: 'https://custom.com' })
    expect(result.site).toBe('https://custom.com')
  })

  test('mergeConfig|withContextOverride|mergesContext', () => {
    const result = mergeConfig('https://example.com', { context: { 'ex': 'https://example.org/' } })
    expect(result.context['@vocab']).toBe('https://schema.org/')
    expect(result.context['ex']).toBe('https://example.org/')
  })

  test('mergeConfig|withValidateFalse|disablesValidation', () => {
    const result = mergeConfig('https://example.com', { validate: false })
    expect(result.validate).toBe(false)
  })

  test('mergeConfig|withPartialLdes|mergesLdes', () => {
    const result = mergeConfig('https://example.com', { ldes: { enabled: false } })
    expect(result.ldes.enabled).toBe(false)
    expect(result.ldes.path).toBe('/changes.jsonld')
  })

  test('mergeConfig|emptyProviders|defaultsToEmptyArray', () => {
    const result = mergeConfig('https://example.com')
    expect(result.providers).toStrictEqual([])
    expect(result.typeRegistrations).toStrictEqual([])
  })
})

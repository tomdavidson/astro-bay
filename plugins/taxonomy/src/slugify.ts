// Topic slug normalization. No imports from this package.

export const slugifyTopic = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest as any
  const t = test as any
  const tdd = !!import.meta.env?.TDD

  describe('slugifyTopic', () => {
    test('slugifyTopic/spaces/convertedToDashes', () => {
      expect(slugifyTopic('Family Courts')).toBe('family-courts')
    })
    test('slugifyTopic/accents/stripped', () => {
      expect(slugifyTopic('Café Résumé')).toBe('cafe-resume')
    })
    test('slugifyTopic/consecutiveDashes/collapsed', () => {
      expect(slugifyTopic('a--b')).toBe('a-b')
    })
    test('slugifyTopic/leadingTrailingDashes/stripped', () => {
      expect(slugifyTopic(' -hello- ')).toBe('hello')
    })
    test('slugifyTopic/specialChars/removed', () => {
      expect(slugifyTopic('Courts & Judges!')).toBe('courts-judges')
    })
    test('slugifyTopic/emptyString/returnsEmpty', () => {
      expect(slugifyTopic('')).toBe('')
    })
    test('slugifyTopic/alreadySlug/unchanged', () => {
      expect(slugifyTopic('public-transit')).toBe('public-transit')
    })

    t.skipIf(tdd)('slugifyTopic/idempotent', async () => {
      const { default: fc } = await import('fast-check')
      fc.assert(fc.property(fc.string(), (s: string) =>
        slugifyTopic(s) === slugifyTopic(slugifyTopic(s))
      ))
    })
    t.skipIf(tdd)('slugifyTopic/outputOnlyValidChars', async () => {
      const { default: fc } = await import('fast-check')
      fc.assert(fc.property(fc.string(), (s: string) =>
        /^[a-z0-9-]*$/.test(slugifyTopic(s))
      ))
    })
    t.skipIf(tdd)('slugifyTopic/noLeadingOrTrailingDashes', async () => {
      const { default: fc } = await import('fast-check')
      fc.assert(fc.property(fc.string(), (s: string) => {
        const slug = slugifyTopic(s)
        return slug === '' || (!slug.startsWith('-') && !slug.endsWith('-'))
      }))
    })
    t.skipIf(tdd)('slugifyTopic/noConsecutiveDashes', async () => {
      const { default: fc } = await import('fast-check')
      fc.assert(fc.property(fc.string(), (s: string) =>
        !slugifyTopic(s).includes('--')
      ))
    })
  })
}

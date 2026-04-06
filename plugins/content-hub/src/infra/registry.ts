const _claimedPrefixes = new Map<string, string>()
const _claimedNames = new Set<string>()

export const claimRoutePrefix = (
  prefix: string,
  hubName: string,
): { readonly ok: true } | { readonly ok: false; readonly claimedBy: string } => {
  const existing = _claimedPrefixes.get(prefix)
  if (existing !== undefined) return { ok: false, claimedBy: existing }
  _claimedPrefixes.set(prefix, hubName)
  return { ok: true }
}

export const claimHubName = (name: string): { readonly ok: true } | { readonly ok: false } => {
  if (_claimedNames.has(name)) return { ok: false }
  _claimedNames.add(name)
  return { ok: true }
}

export const resetRegistry = () => {
  _claimedPrefixes.clear()
  _claimedNames.clear()
}

if (import.meta.vitest) {
  const { test, expect, beforeEach, describe } = import.meta.vitest
  beforeEach(() => resetRegistry())

  describe('claimRoutePrefix', () => {
    test('claimRoutePrefix_newPrefix_returnsOk', () => {
      expect(claimRoutePrefix('articles', 'hub-1').ok).toBe(true)
    })
    test('claimRoutePrefix_duplicatePrefix_returnsConflict', () => {
      claimRoutePrefix('articles', 'hub-1')
      const r = claimRoutePrefix('articles', 'hub-2')
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.claimedBy).toBe('hub-1')
    })
    test('claimRoutePrefix_differentPrefixes_bothOk', () => {
      expect(claimRoutePrefix('writing', 'h1').ok).toBe(true)
      expect(claimRoutePrefix('notes', 'h2').ok).toBe(true)
    })
  })

  describe('claimHubName', () => {
    test('claimHubName_unique_returnsOk', () => {
      expect(claimHubName('writing').ok).toBe(true)
    })
    test('claimHubName_duplicate_returnsConflict', () => {
      claimHubName('default')
      expect(claimHubName('default').ok).toBe(false)
    })
  })
}

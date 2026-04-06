import type { Smart404Options } from '../config.ts'
import type { Smart404Config } from '../config.ts'
import { mergeConfig } from '../config.ts'
import type { PagefindResult } from '../types.ts'

export const buildResult = (overrides: Partial<PagefindResult> = {}): PagefindResult => ({
  url: '/articles/test-article',
  score: 0.8,
  title: 'Test Article',
  ...overrides,
})

export const buildResults = (
  count: number,
  baseScore = 0.9,
  scoreStep = 0.05,
): ReadonlyArray<PagefindResult> =>
  Array.from(
    { length: count },
    (_, i) =>
      buildResult({
        url: `/articles/result-${i}`,
        score: Math.max(0, baseScore - i * scoreStep),
        title: `Result ${i}`,
      }),
  )

export const buildConfig = (overrides?: Smart404Options): Smart404Config => mergeConfig(overrides)

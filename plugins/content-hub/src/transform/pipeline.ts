import { ResultAsync } from 'neverthrow'
import type {
  EntryTransform,
  NormalizedEntry,
  TransformBatchResult,
  TransformContext,
  TransformResult,
} from '../types.ts'

const safeTransform = (
  entry: NormalizedEntry,
  transform: EntryTransform,
  ctx: TransformContext,
): Promise<TransformResult> =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => transform(entry, ctx)),
    cause => cause,
  ).match(
    result => ({
      entry: result,
      warnings: [],
    }),
    cause => ({
      entry,
      warnings: [{ uid: entry.uid, cause }],
    }),
  )

const applyTransforms = (
  entry: NormalizedEntry,
  transforms: ReadonlyArray<EntryTransform>,
  ctx: TransformContext,
): Promise<TransformResult> =>
  transforms.reduce<Promise<TransformResult>>(
    async (previousPromise, transform) => {
      const previous = await previousPromise
      const next = await safeTransform(previous.entry, transform, ctx)

      return {
        entry: next.entry,
        warnings: [...previous.warnings, ...next.warnings],
      }
    },
    Promise.resolve({
      entry,
      warnings: [],
    }),
  )

export const runTransforms = async (
  entries: ReadonlyArray<NormalizedEntry>,
  transforms: ReadonlyArray<EntryTransform>,
  ctx: TransformContext,
): Promise<TransformBatchResult> => {
  const results = await Promise.all(
    entries.map(entry => applyTransforms(entry, transforms, ctx)),
  )

  return {
    entries: results.map(result => result.entry),
    warnings: results.flatMap(result => result.warnings),
  }
}
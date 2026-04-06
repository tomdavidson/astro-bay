import { expect } from 'vitest'
import type { Result } from 'neverthrow'

export const expectOk = <T, E>(result: Result<T, E>): T => {
  expect(result.isOk()).toBe(true)
  return result._unsafeUnwrap()
}

export const expectErr = <T, E>(result: Result<T, E>): E => {
  expect(result.isErr()).toBe(true)
  return result._unsafeUnwrapErr()
}

const getProp = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null && key in value
    ? Reflect.get(value, key)
    : undefined

export const isTddEnabled = (): boolean => {
  const maybeEnv = getProp(getProp(globalThis, 'process'), 'env')
  if (maybeEnv === undefined) return false
  const maybeTdd = getProp(maybeEnv, 'TDD')
  return maybeTdd !== undefined && Boolean(maybeTdd)
}
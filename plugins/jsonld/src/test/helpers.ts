import type { Result } from 'neverthrow'

export const expectOk = <T, E>(result: Result<T, E>): T => {
  if (result.isErr()) {
    throw new Error(`Expected Ok but got Err: ${JSON.stringify(result.error)}`)
  }
  return result.value
}

export const expectErr = <T, E>(result: Result<T, E>): E => {
  if (result.isOk()) {
    throw new Error(`Expected Err but got Ok: ${JSON.stringify(result.value)}`)
  }
  return result.error
}

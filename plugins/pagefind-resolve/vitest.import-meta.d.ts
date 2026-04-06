interface ImportMeta {
  readonly env?: Record<string, string | undefined>
  readonly vitest?: {
    readonly test: (...args: any[]) => unknown
    readonly expect: (...args: any[]) => unknown
    readonly describe: (...args: any[]) => unknown
    readonly vi: { spyOn: (...args: any[]) => { mockImplementation: (...args: any[]) => unknown } }
  }
}

import { defineConfig } from 'vitest/config'

// eslint-disable-next-line import/no-default-export -- vitest requires default export
export default defineConfig({
  test: {
    includeSource: ['src/**/*.ts'],
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    reporters: ['verbose'],
    globals: false,
  },
  define: { 'import.meta.vitest': 'undefined' },
})

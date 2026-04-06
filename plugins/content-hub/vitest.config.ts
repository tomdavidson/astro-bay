// eslint-disable-next-line eslint-plugin-import/no-default-export
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    includeSource: ['src/**/*.ts'],
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    reporters: ['verbose'],
    globals: false,
  },
  define: { 'import.meta.vitest': 'undefined' },
})

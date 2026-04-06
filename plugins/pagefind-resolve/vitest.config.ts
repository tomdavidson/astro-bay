import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    includeSource: ['src/**/*.ts'],
    reporters: ['verbose'],
    globals: false,
    setupFiles: ['src/test/setup.ts'],
  },
  define: { 'import.meta.vitest': 'undefined' },
})

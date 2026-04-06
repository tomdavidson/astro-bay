import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    includeSource: ['src/**/*.ts'],
    include: ['src/**/*.spec.ts', 'src/tests/**/*.spec.ts', 'test/**/*.spec.ts'],
    exclude: ['**/node_modules/**', 'test/fixtures/**'],
    setupFiles: ['src/test/setup.ts'],
    environment: 'node',
  },
})

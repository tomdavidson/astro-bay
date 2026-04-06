import boundaries from 'eslint-plugin-boundaries'
import functional from 'eslint-plugin-functional'
import oxlint from 'eslint-plugin-oxlint'
import preferArrowFunctions from 'eslint-plugin-prefer-arrow-functions'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

// ── Three layers: domain, app, infra ───────────────────────────
// Suffix convention: pricing.domain.ts, pricing.app.ts, postgres.infra.ts
// Promoted subdirs: domain/*.ts, app/*.ts, infra/*.ts
// Tests are a file type (*.spec.ts), not an architectural layer.

// ── Layer file globs ───────────────────────────────────────────
const domainFiles = ['src/**/*.domain.ts', 'src/**/domain/**/*.ts']
const appFiles = ['src/**/*.app.ts', 'src/**/app/**/*.ts']
const infraFiles = ['src/**/*.infra.ts', 'src/**/infra/**/*.ts', 'src/cli/**/*.ts']
const testFiles = ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/test/**/*.ts']

// ── Boundary enforcement ───────────────────────────────────────
// Three layers + tests. No shared/composition layers needed.
const boundaryElements = [
  { type: 'domain', pattern: domainFiles },
  { type: 'app', pattern: appFiles },
  { type: 'infra', pattern: infraFiles },
  { type: 'test', pattern: testFiles },
]

// Dependency inversion: inner layers cannot import outer layers
const boundaryRules = [
  { from: 'domain', allow: ['domain'] },
  { from: 'app', allow: ['domain', 'app'] },
  { from: 'infra', allow: ['domain', 'app', 'infra'] },
  { from: 'test', allow: ['domain', 'app', 'infra', 'test'] },
]

// ── Functional rules (global defaults) ─────────────────────────
// These are the core FP rules that oxlint cannot replicate.
// ESLint owns all functional/* enforcement.
const functionalRules = {
  'functional/no-loop-statements': 'error',
  'functional/no-try-statements': 'error',
  'functional/no-throw-statements': 'error',
  'functional/no-let': ['error', { allowInForLoopInit: false }],
  'functional/no-classes': 'error',
  'functional/no-this-expressions': 'error',
  'functional/immutable-data': ['warn', { ignoreImmediateMutation: true, ignoreClasses: true }],
  'functional/prefer-readonly-type': 'warn',
  'functional/no-expression-statements': ['error', {
    ignoreVoid: true,
    ignoreCodePattern: ['^expect', '^assert'],
  }],
  'functional/no-return-void': 'error',
}

// ── AST selector bans (oxlint cannot do ESQuery selectors) ─────
const restrictedSyntax = ['error', {
  selector: ":function > Identifier.params[typeAnnotation.typeAnnotation.type='TSBooleanKeyword']",
  message: 'Boolean params are banned. Split into separate functions.',
}, {
  selector: "CallExpression[callee.property.name='_unsafeUnwrap']",
  message: 'Use .map(), .andThen(), or .match() instead.',
}, {
  selector: "CallExpression[callee.property.name='_unsafeUnwrapErr']",
  message: 'Use .mapErr(), .andThen(), or .match() instead.',
}]

// ── Domain purity: ban IO imports in domain files ──────────────
const domainImportBans = {
  patterns: [{
    group: ['fs', 'fs/*', 'path', 'http', 'https', 'net', 'child_process', 'crypto'],
    message: 'Domain must be pure. No Node.js IO.',
  }, {
    group: ['express', 'fastify', 'koa', 'hono', 'elysia'],
    message: 'Domain must be pure. No HTTP frameworks.',
  }, {
    group: ['pg', 'mysql*', 'redis', 'ioredis', 'mongoose', '@prisma/*', 'kysely'],
    message: 'Domain must be pure. No database drivers.',
  }, {
    group: ['@aws-sdk/*', '@azure/*', '@google-cloud/*'],
    message: 'Domain must be pure. No cloud SDKs.',
  }],
}

// ── Build config array ─────────────────────────────────────────
const config = [
  { ignores: ['node_modules/**', 'dist/**', 'eslint.config.mjs'] },

  // Global: all source files (app-layer defaults)
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      functional,
      'prefer-arrow-functions': preferArrowFunctions,
      boundaries,
    },
    settings: { 'boundaries/elements': boundaryElements },
    rules: {
      ...functionalRules,
      'no-restricted-syntax': restrictedSyntax,

      // Arrow function enforcement: ESLint owns the *semantic* rule
      // (must use arrows). dprint owns arrow *formatting* (parens, wrapping).
      'prefer-arrow-functions/prefer-arrow-functions': ['error', {
        allowNamedFunctions: false,
        classPropertiesAllowed: false,
        disallowPrototype: true,
        returnStyle: 'unchanged',
        singleReturnOnly: false,
      }],

      // Boundaries
      'boundaries/element-types': ['error', { default: 'disallow', rules: boundaryRules }],
    },
  },

  // ── Domain: tighten for purity ─────────────────────────────
  {
    files: domainFiles,
    rules: {
      'no-restricted-imports': ['error', domainImportBans],
      'functional/prefer-readonly-type': 'error',
    },
  },

  // ── Infrastructure: imperative shell allowances ────────────
  {
    files: infraFiles,
    rules: {
      'functional/no-let': 'warn',
      'functional/no-loop-statements': 'warn',
      'functional/no-try-statements': 'off',
      'functional/no-throw-statements': 'off',
      'functional/no-expression-statements': 'off',
      'functional/no-return-void': 'off',
      'functional/immutable-data': 'off',
      'functional/no-classes': ['error', {
        ignoreIdentifierPattern: '^.*(Controller|Adapter|Module|Client|Provider|Gateway)$',
      }],
      'functional/no-this-expressions': 'off',
    },
  },

  // ── Tests: fully relax FP rules ────────────────────────────
  {
    files: testFiles,
    rules: {
      'functional/no-let': 'off',
      'functional/no-loop-statements': 'off',
      'functional/no-try-statements': 'off',
      'functional/no-throw-statements': 'off',
      'functional/no-expression-statements': 'off',
      'functional/no-return-void': 'off',
      'functional/immutable-data': 'off',
      'functional/no-classes': 'off',
      'functional/no-this-expressions': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  // Deduplicate: turn off anything oxlint already handles
  ...oxlint.buildFromOxlintConfigFile('./oxlintrc.json'),
]

// eslint-disable no-default-export
export default defineConfig(...config)

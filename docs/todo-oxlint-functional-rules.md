# Oxlint Functional Plugin Rules — Migration TODO

Goal: move as many ESLint rules as possible into oxlint for speed, keeping ESLint
only for what oxlint structurally cannot do.

## What stays in ESLint (permanently or until oxlint adds capabilities)

| Rule / Plugin | Reason |
|---|---|
| `eslint-plugin-boundaries` (element-types) | Layer enforcement via custom element patterns. No oxlint equivalent concept. |
| `no-restricted-syntax` (ESQuery selectors) | Boolean param ban, `unsafeUnwrap`/`unsafeUnwrapErr` bans. Oxlint has no ESQuery engine, including in its JS plugin system. |
| `no-restricted-imports` with pattern groups | Domain IO bans (`fs/*`, `pg`, `express`, etc.). Oxlint's `no-restricted-imports` only supports exact strings, not group patterns. File an enhancement issue. |
| `prefer-arrow-functions` | No oxlint equivalent. Lower priority. |
| `functional/immutable-data` | Deep mutation tracking. Complex, type-aware. Long-term. |
| `functional/prefer-readonly-type` | Type-aware. Long-term. |
| `functional/no-return-void` | Type-aware. Long-term. |
| `functional/no-expression-statements` | Needs `ignoreVoid` and `ignoreCodePattern` options. Medium complexity. |

## What can move to oxlint (PR candidates)

These are all simple AST visitors with no type information needed. They would fit
under a `functional` category or `eslint-plugin-functional` compatibility layer
in oxlint. Could land as a single PR or small series.

| Rule | Semantics | Complexity |
|---|---|---|
| `functional/no-let` | Ban `let` declarations | Trivial — AST node check |
| `functional/no-loop-statements` | Ban `for`, `while`, `do-while`, `for-in`, `for-of` | Trivial — AST node check |
| `functional/no-throw-statements` | Ban `throw` | Trivial — AST node check |
| `functional/no-try-statements` | Ban `try` | Trivial — AST node check |
| `functional/no-classes` | Ban `class` declarations/expressions | Slightly more complex — needs `ignoreIdentifierPattern` option for infra overrides |
| `functional/no-this-expressions` | Ban `this` | Trivial — AST node check |

## Approach

1. Open an oxlint issue or RFC proposing a `functional` rule category.
2. Implement rules 1-4 (no-let, no-loop, no-throw, no-try) as the initial PR.
   These have zero options and are pure AST visitors.
3. Follow up with no-classes (needs ignoreIdentifierPattern) and no-this.
4. Once landed, update `oxlintrc.json` overrides to enable them per layer and
   remove the corresponding `eslint-plugin-functional` rules.
5. The ESLint config's `...oxlint.buildFromOxlintConfigFile()` dedup handles
   the transition automatically for any rules with matching names.

## Also file

- `no-restricted-imports` pattern group support — enhancement to existing oxlint
  rule. Would allow migrating domain IO bans out of ESLint.

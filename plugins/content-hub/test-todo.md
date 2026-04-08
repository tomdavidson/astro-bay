# Content Hub test TODO

This file tracks coverage gaps that are not practical to close with the current pure Vitest unit tests alone.
Several of these likely need JSDOM, Vitest Browser Mode, Astro integration render tests, or Playwright browser-level tests because they depend on rendered HTML, client-side behavior, or real browser behavior.

## Current status

Covered now:
- Config resolution and route injection logic.
- Browse data projection.
- JSON-LD provider shape.
- Pure static path builders for article index and topic hub.

Not covered yet:
- Rendered `.astro` page output.
- Presence or absence of UI elements in generated HTML.
- Client-side browse behavior after hydration.
- Browser-only behavior such as DOM interaction, layout-sensitive behavior, and full-page flows.

## Likely needs JSDOM or Vitest Browser Mode

### Rendered Astro HTML assertions
- `ArticleIndex.astro` renders `#browse-data` with all entries.
- `ArticleIndex.astro` renders only `fallbackEntries` as server HTML cards.
- `ArticleIndex.astro` does not render pagination UI anymore.
- `ArticleIndex.astro` keeps the `<noscript>` message.
- `TopicHub.astro` renders `#browse-data` with all topic entries.
- `TopicHub.astro` renders only `fallbackEntries` as server HTML cards.
- `TopicHub.astro` shows `entries.length` in the header count, not fallback count.
- `TopicHub.astro` does not render pagination UI anymore.
- `TopicHub.astro` keeps breadcrumbs, child topics, sibling topics, and related topics sections when data exists.

### Component-level DOM assertions
- `ArticleCard.astro` emits expected href, date, excerpt, source badge, and topic badges.
- `TopicList.astro` honors `limit` in rendered output.
- `TopicBadge.astro` renders count only when provided.
- `Breadcrumb.astro` marks the last item with `aria-current="page"`.
- `PageShell.astro` applies `data-pagefind-ignore` when requested.

### Candidate approach
- Start with Astro render tests or Vitest in a DOM-oriented environment for static markup checks.
- Prefer Vitest Browser Mode over plain JSDOM if DOM fidelity becomes an issue.

## Likely needs Playwright

### End-to-end generated-site checks
- Build a fixture site and verify generated routes exist at:
  - `/articles`
  - `/articles/<uid>`
  - `/topics`
  - `/topics/<slug>`
- Assert article index initial page shows only fallback item count but client-side browse data supports the full dataset.
- Assert topic pages behave the same way.
- Assert there are no `/articles/2` or `/topics/<slug>/2` paginated fallback routes after the change.
- Assert JSON-LD alternate links resolve from generated pages.
- Assert Pagefind-related attributes are present in the built article/topic HTML.

### Real browser interaction
- Browse UI hydrates and can sort, filter, and paginate client-side once the interactive layer exists.
- No-JS fallback remains readable and useful.
- Navigation between topic badges, breadcrumbs, and article links works in the built site.
- Keyboard navigation and basic accessibility flows work in real pages.

### Candidate approach
- Use Playwright for built-site verification and user-flow coverage because it runs against a real browser and is better suited for interaction, layout, and end-to-end validation.

## Open questions for later

- Whether to use Astro render and integration coverage first, then reserve Playwright for a few high-value end-to-end checks.
- Whether Vitest Browser Mode can replace some JSDOM-style tests to reduce false positives from simulated DOM behavior.
- Whether a fixture app under `test/fixtures/` should be added to snapshot generated HTML from `astro build`.

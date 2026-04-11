# Test TODO — Deferred Integration & E2E Tests

These tests require `setupServer` (MSW), Playwright, or a real `astro build`
and cannot be covered with vitest + the content API alone.

---

## 1. Pagefind Topic Attributes

**Requires:** `astro build` + Pagefind index inspection

Verify that built topic pages include `data-pagefind-filter` and
`data-pagefind-meta` attributes so Pagefind indexes topics in search.

- [ ] Topic hub page has `data-pagefind-filter="topic"` on the heading.
- [ ] Article pages have `data-pagefind-meta="topic"` for each resolved topic.
- [ ] Pagefind index output contains topic facet entries.

---

## 2. JSON-LD File Output

**Requires:** `astro build` + filesystem assertion

Verify that `<script type="application/ld+json">` blocks are present in the
built HTML output for each page type.

- [ ] Article pages emit `BlogPosting` JSON-LD.
- [ ] Topic pages emit `DefinedTerm` JSON-LD.
- [ ] Topic hub index emits `CollectionPage` JSON-LD.
- [ ] `sameAs` and `about` fields are populated when entry data provides them.

---

## 3. BrowseTable Hydration (JS Component)

**Requires:** Playwright (browser runtime)

The BrowseTable is a client-side component with an external dependency
(TanStack Table). Once built, it needs browser-level verification.

- [ ] Table renders rows matching the serialized BrowseRow data.
- [ ] Column sorting toggles work (click date header → newest first).
- [ ] Topic filter narrows visible rows.
- [ ] No-JS fallback table is visible when JS is disabled.

---

## 4. RSS Feed Endpoint

**Requires:** `setupServer` (MSW) or `astro build` + HTTP assertion

- [ ] GET `/rss.xml` returns valid XML with `Content-Type: application/xml`.
- [ ] Feed excludes draft entries.
- [ ] Feed excludes feed-origin entries (no re-syndication).
- [ ] Each `<item>` has `<link>`, `<title>`, `<pubDate>`, and `<category>` elements.

---

## 5. Alias Redirect HTTP Behaviour

**Requires:** `astro build` + HTTP assertion (or Playwright navigation)

- [ ] Navigating to an alias path returns a 301 redirect to the canonical UID path.
- [ ] The redirect `Location` header uses the `articleBase` prefix.
- [ ] Alias collision at build time produces a build error (not a silent override).

---

## 6. Route-Conflict Integration Hook

**Requires:** Multi-hub `astro build` fixture

When two content-hub instances claim overlapping route prefixes, the
`claimRoutePrefix` registry should throw at build time.

- [ ] Two hubs with the same `routePrefix` cause a build-time error.
- [ ] Two hubs with the same `hubName` cause a build-time error.
- [ ] Non-overlapping prefixes build successfully.

---

## 7. Multi-Hub Deduplication Wiring

**Requires:** Multi-hub `astro build` fixture + content inspection

When the same feed entry appears in two hub collections, the aggregate
layer should deduplicate by `sourceId`.

- [ ] Entry with identical `sourceId` across hubs appears in only one hub's output.
- [ ] The "winning" hub is deterministic (alphabetical by collection name or explicit priority).

---

## 8. No-JS Index Pages

**Requires:** Playwright with JS disabled

- [ ] `/topics/` renders a static HTML list of all topics with counts.
- [ ] `/articles/` renders a static HTML table of all published articles.
- [ ] Links on both pages navigate correctly.
- [ ] Pages are accessible (heading hierarchy, semantic HTML, skip link).

---

## 9. Ancestor Expansion Transform Integration

**Requires:** vitest with optional `astro-taxonomy` peer installed, or fixture-based `astro build`

The pure-logic ancestor tests were removed because they reimplemented the transform instead of exercising the real code path. Replace them with a real integration test once the optional peer is available in test runtime.

- [ ] `buildAncestorExpansionTransform` loads taxonomy graph from `astro-taxonomy` when present.
- [ ] Entry with child topic expands to include ancestor slugs in `resolvedTopics`.
- [ ] Ancestor expansion deduplicates topics already present.
- [ ] Missing optional peer degrades gracefully without throwing.

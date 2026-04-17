# test-todo.md

## Tests requiring infrastructure not available in plain vitest

Tests here need `setupServer` (MSW), Playwright, or a real Astro build process.
They are explicitly deferred and should not block CI.

---

### 1. Pagefind attribute contract — Playwright / Astro build

**What:** Verify that every built article page emits the correct `data-pagefind-*`
attributes in the rendered HTML.

**Why deferred:** Requires a full `astro build` output to inspect. Cannot be
tested via Astro's content API alone because attribute emission happens in the
`.astro` template, not in a pure function.

**Assertions to make (when implemented):**

- `article[data-pagefind-body]` is present on every article page.
- `h1[data-pagefind-weight="10"]` matches the entry title.
- One `meta[data-pagefind-filter="topic:content"]` per `resolvedTopic`.
- `meta[data-pagefind-meta="uid:content"]` matches entry uid.
- `meta[data-pagefind-meta="excerpt:content"]` matches entry excerpt when present.
- `meta[data-pagefind-filter="source:content"]` matches entry source.
- Topic index and topic hub pages carry `data-pagefind-ignore`.
- No `data-pagefind-*` attributes leak onto pages not listed above.

**Tooling:** Playwright + `astro build` fixture, or `cheerio` parsing of build
output in a shell-based test.

---

### 2. JSON-LD file output — Astro build integration

**What:** Verify that `astro build` emits correctly structured `.jsonld` files
under the build output directory.

**Why deferred:** `writeJsonLdRoutes` (in `integration.ts`) runs inside the
`astro:build:done` hook and writes to the filesystem. Cannot be exercised
without running the full build.

**Assertions to make:**

- Each article emits `dist/articles/<uid>/index.jsonld` with `@type: BlogPosting`.
- The article index emits `dist/articles/index.jsonld` with `@type: CollectionPage`.
- Each topic emits `dist/topics/<slug>/index.jsonld` with `@type: DefinedTerm`.
- Topic index emits `dist/topics/index.jsonld` with `@type: CollectionPage`.
- Every file contains `@context: https://schema.org`.
- `sameAs`, `about`, `skos:broader`, and `skos:narrower` fields are valid
  absolute URLs when site config is present.

**Tooling:** Build fixture + `fs.readFile` assertions, or Playwright fixture
that boots a preview server and fetches `.jsonld` routes.

---

### 3. BrowseTable component hydration — Playwright

**What:** Verify that the `BrowseTable` Astro component hydrates correctly and
that TanStack Table renders rows, sort, filter, and pagination.

**Why deferred:** Requires a running browser to execute the client-side script.
Astro's content API does not execute `<script>` tags or island hydration.

**Assertions to make:**

- The `#browse-data` `<script>` element contains valid JSON on the rendered page.
- After hydration, table rows match the count of published entries.
- Sorting by date rearranges rows with nulls-last.
- Filtering by topic narrows visible rows to matching entries.
- Pagination controls advance and retreat pages correctly.
- The `<noscript>` fallback message is present in server-rendered HTML.

**Tooling:** Playwright with `page.waitForSelector('[data-browse-ready]')` or
similar hydration sentinel.

---

### 4. RSS feed endpoint — setupServer (MSW) or build fixture

**What:** Verify that the `GET /feed.xml` endpoint returns valid RSS/Atom XML
with correct entries, filtering out drafts and feed-origin entries.

**Why deferred:** The `toFeedItems` pure function is covered by `utils.spec.ts`.
The full endpoint test requires an HTTP response with XML parsing, and the
`@astrojs/rss` integration is only exercised in a real Astro build or via an
HTTP call.

**Assertions to make:**

- Response `Content-Type` is `application/rss+xml` or `application/atom+xml`.
- Number of `<item>` / `<entry>` elements matches published non-feed entries.
- `<link>` element for each item matches `articles/<uid>`.
- `<pubDate>` is present and parseable for dated entries.
- Feed includes `<link rel="hub">` element pointing to the configured WebSub hub.
- Draft entries are absent from the feed.
- Feed-origin entries are absent (no re-syndication).

**Tooling:** `setupServer` (MSW) to intercept the RSS endpoint, or Playwright
fetching `/feed.xml` from a preview server.

---

### 5. Alias redirect resolution — Astro build + HTTP

**What:** Verify that navigating to an old slug (alias) results in a 301/302
redirect to the canonical permalink.

**Why deferred:** Redirect rules are injected into Astro's native `redirects`
config in `astro:config:setup`. Actual HTTP redirect behaviour depends on the
adapter (Netlify, Vercel, Cloudflare, or static HTML fallback). Cannot be
tested via the content API.

**Assertions to make:**

- `GET /articles/<old-slug>` returns `301` or `302`.
- `Location` header points to `/articles/<current-uid>`.
- Build does not fail when two entries share an alias (AliasCollision is
  surfaced as a build error — tested separately as a unit test in
  `permalinks.spec.ts`).

**Tooling:** Playwright or `supertest` against a Node adapter preview server.

---

### 6. Route conflict guard — integration test

**What:** Verify that configuring two `contentHub` instances with overlapping
route prefixes throws a `RouteConflict` error before any routes are injected.

**Why deferred:** The guard runs inside the `astro:config:setup` hook, which
requires instantiating an `AstroIntegration` and simulating the Astro lifecycle.

**Current coverage:** `registry.spec.ts` (inline `import.meta.vitest`) covers
`claimRoutePrefix` and `claimHubName` at the pure-function level. The
integration-level throw (in `integration.ts`) is not yet exercised.

**Assertions to make:**

- `contentHub` with a colliding `articleBase` throws with message containing
  the conflicting route prefix.
- Two hubs with distinct prefixes configure without error.

**Tooling:** Astro lifecycle test harness (`createBuilder` from
`@astrojs/test-utils`) or a lightweight stub of the `AstroConfig` object.

---

### 7. Multi-hub `aggregateEntries` cross-hub deduplication — Astro content API

**What:** Verify that when two hubs share a collection name, `aggregateEntries`
deduplicates entries by `sourceId` across both hubs.

**Why deferred:** `aggregateEntries` itself is a pure function and is covered
by `aggregate.spec.ts`. The cross-hub scenario requires two `contentHub`
integration instances to inject overlapping collections, which involves the
Astro build pipeline.

**Note:** The deduplication unit behaviour is partially covered by
`aggregate.spec.additions.ts`. Only the full two-hub build wiring needs
Playwright or a build fixture.

New files and what they close

taxonomy.spec.ts — The existing file had no property tests and skipped slugifyTopic entirely for the non-TDD path. This adds five slugifyTopic property tests (idempotency, valid chars, no leading/trailing dashes, no consecutive dashes, empty-string guard), plus missing basic assertions for topicsWithCounts and entriesForTopic.

paginate.spec.ts — Zero coverage today. Covers all paginate boundary conditions (first page, last page, overflow, exact multiple, empty input, hasPrev/hasNext, total) plus three property tests verifying full-roundtrip completeness, max-per-page invariant, and total ≥ 1.

permalinks.spec.ts — Zero coverage today. Covers detectCollisions (ok/err/empty/single) and collectAliasRoutes (mapping, no-aliases, collision, articleBase prefix) with a property test verifying unique UIDs never collide.

transform-pipeline.spec.ts — Zero coverage today. Covers safeTransform (success, sync throw, async reject, receives context) and runTransforms (sequential composition, parallel execution, fault isolation, empty transforms, draft-true preservation).

schema.spec.ts — Zero coverage today. Covers contentHubSchema and feedEntrySchema defaults, required fields, and type coercion using basic assertions. Uses zod-fast-check (ZodFastCheck().inputOf / .outputOf) for property tests confirming the arbitrary always produces a parse-passing value and the output always satisfies the structural contract.

utils.spec.ts — Zero coverage today. Covers toRssItem (link, title, description, pubDate, categories) and toFeedItems (draft exclusion, feed-origin exclusion, empty array, all-vault pass-through).

browse.spec.additions.ts — Merges into existing browse.spec.ts. Adds null-date, source, and excerpt propagation cases, a zod-fast-check roundtrip property test for toBrowseData, and column-id assertions for createBrowseColumns.

aggregate.spec.additions.ts — Merges into existing aggregate.spec.ts. Adds three zod-fast-check property tests (uid always string, uidFallback logic, topics always array) and filterPublished/sortByDate invariant properties (subset, dated-before-undated).

ancestors.spec.ts — Zero coverage today. Tests loadTaxonomyGraph graceful-undefined behaviour and buildAncestorExpansionTransform via an inline replication of the pure expandWithAncestors logic, avoiding a hard dependency on the optional peer at test-time.

test-todo.md — Documents seven deferred test scenarios that require setupServer/MSW, Playwright, or a real astro build — Pagefind attributes, JSON-LD file output, BrowseTable hydration, RSS feed endpoint, alias redirect HTTP behaviour, route-conflict integration hook, and multi-hub deduplication wiring.
Placement notes

    taxonomy.spec.ts, paginate.spec.ts, permalinks.spec.ts, transform-pipeline.spec.ts, schema.spec.ts, utils.spec.ts, ancestors.spec.ts → drop alongside their source files in src/.

    browse.spec.additions.ts, aggregate.spec.additions.ts → merge content into the existing sibling .spec.ts files.

    test-todo.md → repo root or test/ directory.

    The zod-fast-check package needs to be added to devDependencies (pnpm add -D zod-fast-check). Since zod and fast-check are already peers/devDeps, the only new install is the integration shim.

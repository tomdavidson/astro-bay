# TODO

## SSR readiness checklist

### 1. Product and API contract

- [ ] Decide whether SSR is supported in `server`, `hybrid`, or both Astro output modes.
- [ ] Decide whether SSR support is internal-only first or part of the public plugin API.
- [ ] Define which routes support SSR: article page, article index, topic hub, topic index.
- [ ] Define whether injected routes remain the main delivery mechanism in SSR mode.
- [ ] Define the stable runtime API surface for request-time queries.

### 2. Request-time data APIs

- [ ] Design request-time helpers for article lookup by UID.
- [ ] Design request-time helpers for topic lookup and topic page slices.
- [ ] Design request-time helpers for browse/index datasets.
- [ ] Ensure SSR helpers expose stable domain outputs, not raw implementation details.
- [ ] Keep request-time APIs aligned with the existing TanStack Table query contract.

### 3. Cache semantics

I have arch question about this. Seems like it should be covered by astro.

- [ ] Replace or redesign the module-level hub cache for request-time use.
- [ ] Define cache keys beyond hub name if runtime inputs can affect results.
- [ ] Decide whether SSR uses no cache, per-process cache, TTL cache, or explicit invalidation.
- [ ] Document freshness expectations for local content, feed content, and transform outputs.
- [ ] Prove cache behavior is safe across concurrent requests.

### 4. Route semantics and errors

- [ ] Specify 404 behavior for unknown article UID.
- [ ] Specify 404 behavior for unknown topic slug.
- [ ] Specify behavior for out-of-range page numbers.
- [ ] Specify canonical URL behavior for first page vs paginated pages.
- [ ] Specify redirect interactions between aliases and SSR-rendered routes.

### 5. Pagination and browse model

- [ ] Finish removing the current `pagination.pageSize` vs `browse.pageSize` split.
- [ ] Make `browse.pageSize` the single page-size contract.
- [ ] Decide whether SSR listing pages paginate on the server, client, or both.
- [ ] Keep the no-JS fallback behavior explicit and documented.
- [ ] Ensure topic hub and article index use the same paging rules.

### 6. JSON-LD and machine-readable routes

- [ ] Decide whether SSR mode serves dynamic JSON-LD, static sibling files, or both.
- [ ] Define how article JSON-LD and topic JSON-LD are generated at request time.
- [ ] Define cache headers or caching guidance for JSON-LD responses.
- [ ] Ensure JSON-LD output stays consistent between SSG and SSR modes.
- [ ] Document content negotiation expectations if that remains a goal.

### 7. Integration boundaries

- [ ] Ensure astro-taxonomy remains the owner of hierarchy semantics.
- [ ] Ensure astro-jsonld integration still works without requiring users to hold fragile runtime
      handles.
- [ ] Ensure multi-hub behavior remains isolated and deterministic in SSR mode.

### 8. Testing

### 9. Docs and rollout

- [ ] Document SSR support as experimental before calling it stable.
- [ ] Add README guidance for when to choose SSG vs SSR vs hybrid.
- [ ] Add examples for custom SSR article and topic pages.
- [ ] Document operational tradeoffs: cache, freshness, performance, hosting adapter constraints.
- [ ] Only promote SSR helpers to public API after contracts and tests are stable.

| Content negotiation | ❌ **Missing** | No CDN rewrite rules, no Accept header handling[^1] |

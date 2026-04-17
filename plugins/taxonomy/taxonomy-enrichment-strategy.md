# Taxonomy Enrichment Strategy

Summary of tools and approach for semantic tagging of content items and curation of the taxonomy graph in astro-taxonomy. All tools run locally at build time or as CLI commands with no external API calls.

## Two Concerns

**Semantic tagging** ensures every content item carries a full set of relevant taxonomy terms, including terms the author didn't explicitly add. This runs in the content-hub data loader pipeline at build time, enriching each `NormalizedEntry` before route generation.

**Graph curation** maintains the taxonomy DAG: suggesting new edges (broader/narrower/related), adding synonym labels, and validating structural integrity. This runs as a periodic CLI workflow, producing suggestions for human review.

## Semantic Tagging: ONNX/MiniLM Embeddings

MiniLM-L6-v2 (~23MB model) runs locally in Node via Transformers.js and ONNX Runtime. At build time, the data loader:

1. Embeds each taxonomy term (label + alt-labels) into a vector. These vectors are cached between builds and only recomputed when the taxonomy changes.
2. Embeds each article's text content (title + body or excerpt) into a vector.
3. Computes cosine similarity between each article vector and each taxonomy term vector.
4. Terms scoring above a confidence threshold that are not already in the article's frontmatter become tag suggestions.

The suggestions can be applied automatically (high confidence, above a strict threshold) or flagged for human review (moderate confidence). The threshold is tunable per taxonomy term since broad terms like "policy" need a higher bar than specific terms like "rent control."

### Why ONNX over TF-IDF for tagging

TF-IDF is a lexical matcher: it scores exact word overlap weighted by statistical rarity. If the article says "low-income apartments" and the taxonomy term is "affordable housing," TF-IDF scores zero. ONNX embeddings encode meaning, so semantically equivalent phrases match even without shared vocabulary. For a content hub aggregating multiple sources (vaults, feeds) where different authors use different terminology, semantic matching is necessary.

### Build cost

The model loads once per build (~2 seconds). Per-article inference is ~10-50ms. For 500 articles, total enrichment adds under 30 seconds to the build. The model file is downloaded once and cached locally.

## Client-Side Filtering: TF-IDF in TanStack Table

TF-IDF has a separate role as a custom filter function in TanStack Table's browse UI. When a user types in the filter input on a collection page, TF-IDF scores visible rows by term relevance rather than simple substring matching.

The corpus statistics (inverse document frequencies) are precomputed at build time and embedded in the page as JSON alongside the table data. The filter function is pure arithmetic on those precomputed values: no model, no async operations, instant feedback as the user types.

This provides "smarter than substring, lighter than Pagefind" filtering within a single collection view. Pagefind handles full-site search; TF-IDF handles "type to narrow this list" within a browse table.

## Graph Curation: WordNet + Co-occurrence

### WordNet for relationship suggestions

The `natural` npm package includes a WordNet interface (~30MB dictionary, downloaded once). For each taxonomy term:

- **Synonyms** become `skos:altLabel` candidates (alternative labels that resolve to the canonical term).
- **Hypernyms** (more general terms) become `skos:broader` edge candidates.
- **Hyponyms** (more specific terms) become `skos:narrower` edge candidates.

Results are intersected with the existing taxonomy vocabulary. Suggestions for terms not already in the taxonomy are ignored unless the operator is actively expanding the vocabulary. Output is a structured suggestions file (JSON or markdown) for human review.

### Co-occurrence for related-term edges

At build time, count how often two taxonomy terms appear together on the same article. Pairs with high co-occurrence relative to their individual frequencies are candidates for `skos:related` edges. This is pure arithmetic over the entries array, no NLP involved.

The formula is Pointwise Mutual Information (PMI): `log2(P(A,B) / (P(A) * P(B)))`. High PMI means the terms co-occur more than chance would predict, suggesting a meaningful relationship worth codifying as an edge.

### Workflow

Graph curation runs as a CLI command, not in the build pipeline. The operator runs it when:

- Adding new terms to the taxonomy
- Periodically auditing the graph (quarterly, or after a large content import)
- Reviewing auto-tagging patterns that suggest missing relationships

The CLI outputs a suggestions report. The operator reviews and commits accepted changes to the taxonomy source file. The next build picks up the updated graph.

## Integrity Checks: Build Gate

These validations run after the taxonomy graph is constructed and before any output is generated. Violations fail the build.

### Must fail the build

- **No cycles** in `broader`/`narrower` edges. The graph must be a directed acyclic graph.
- **No broken references.** Every `broader`/`narrower` target ID must exist in the graph.
- **No duplicate canonical terms.** Two terms with different IDs but identical labels after normalization (lowercase, trim, collapse whitespace) indicate a merge needed.
- **Symmetric consistency.** If term A declares `broader: B`, then B must list A in its `narrower` set (or the system must infer this automatically and warn if the source files are inconsistent).
- **Alt-label uniqueness.** No `altLabel` on one term may match another term's canonical label. That would create ambiguous resolution where a tag could map to two different canonical terms.

### Should warn (non-blocking)

- **Orphan terms.** A term with no articles and no children that have articles. May indicate a stale term that should be pruned or a gap in content coverage.
- **Shallow branches.** A parent with only one child may indicate over-specificity. Suggest merging up.
- **High fan-out.** A term with more than ~15 direct children may need an intermediate grouping level.
- **Untagged articles.** Articles that received no taxonomy terms from either frontmatter or ONNX enrichment. May indicate content outside the taxonomy's coverage.

## Tool Summary

| Tool                                   | Role                           | Runs when                                | Size                   | Dependencies                  |
| -------------------------------------- | ------------------------------ | ---------------------------------------- | ---------------------- | ----------------------------- |
| Transformers.js + ONNX Runtime         | Semantic auto-tagging          | Build-time data loader                   | ~23MB model            | `@xenova/transformers`        |
| TF-IDF (from `natural` or hand-rolled) | Client-side table filter       | Client-side (precomputed stats at build) | ~2KB runtime code      | Corpus stats as embedded JSON |
| WordNet (via `natural`)                | Graph relationship suggestions | CLI, periodic                            | ~30MB dictionary       | `natural`                     |
| Co-occurrence / PMI                    | Related-term edge suggestions  | CLI or build-time                        | Zero (just arithmetic) | None                          |
| DAG validation                         | Integrity checks               | Build-time, pre-ship gate                | Zero                   | None                          |

## Decisions Not Made

- Exact confidence threshold for auto-tagging (needs tuning against real content)
- Whether auto-tag suggestions are applied automatically or always require human review
- Whether Transformers.js model is bundled in the package or downloaded on first build
- Whether WordNet suggestions feed directly into the taxonomy source file or go through a separate approval queue
- Storage format for cached embedding vectors between builds (JSON, binary, SQLite)

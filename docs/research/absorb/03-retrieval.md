# 03 Retrieval, ranking and deduplication (prefix AB-RET)

## Executive summary

Engram's core ranker (`packages/core/src/plane/retrieve.ts`) scores each item alone by term share, confidence and a recency of 1/(1+age_days/30) (hyperbolic, 0.5 at 30 days, not an exponential half-life), and reports each component. That is deterministic and explainable, but lexical only. The evidence from 2026 papers is that a dense channel helps on some setups (fusion on LoCoMo in 2606.04194) and adds little on others (LongMemEval-S), and the evidence conflicts: AgentIR (2605.25092) finds BM25 alone strongest on LoCoMo, so an optional hybrid tier must be opt-in and measured per benchmark. The path that keeps rules 1, 4, 6 and 7 is: embeddings are computed outside core (an adapter-side embedder, cached by content hash and model revision), handed to core as plain vectors, and core only computes cosine, fuses ranks and reports each component. Best absorbable pieces: Transformers.js (Apache-2.0) with MIT or Apache-2.0 models (bge-small, gte-small, nomic-embed v1.5, all-MiniLM), sqlite-vec or a flat pure TypeScript index for storage, and the SemDeDup recipe for a semantic near-duplicate lint. MinHash (ADR 0018's near-duplicate form) is not implemented yet (card L1 did only the exact lint), so it should come first and cheaply. A cross-encoder reranker is deferred: one 2026 study saw one lower Hit@1 by 6.9 pp.

Everything below was checked with `gh api`, `npm view` or the Hugging Face API on 2026-11-21 unless marked unverified. Only abstracts of the papers were read.

## Landscape

| name | URL | licence | stars / last activity | language | what it gives us | absorb mode |
|---|---|---|---|---|---|---|
| Transformers.js | github.com/huggingface/transformers.js | Apache-2.0 | 16,439; push 2026-11-18; npm 4.3.2 | JS | local ONNX embedders and cross-encoders in Node | depend (adapter side only) |
| fastembed-js | github.com/Anush008/fastembed-js | MIT | 177; push 2026-09-24; **repository archived (read-only)**; npm 3.0.0 (modified 2026-09-30) | TS | thinner local embedder | ideas only (archived upstream, do not depend) |
| sqlite-vec | github.com/asg017/sqlite-vec | Apache-2.0 (npm says MIT OR Apache) | 8,273; push 2026-05-18; npm 0.1.9 | C | exact KNN in SQLite | depend, optional |
| sqlite-vector (SQLite Cloud) | github.com/sqliteai/sqlite-vector | Apache-2.0 (gh api, and LICENSE.md is the plain Apache text) | 1,222; push 2026-11-01 | C | alternative SQLite vector extension | ideas only |
| LanceDB | github.com/lancedb/lancedb | Apache-2.0 | 11,959; push 2026-11-21 | Rust, Node bindings | embedded vector DB | ideas only (new store, heavy) |
| USearch | github.com/unum-cloud/usearch | Apache-2.0 | 4,389; push 2026-11-18 | C++ | HNSW, Node binding | not needed at our sizes |
| PGlite | github.com/electric-sql/pglite | Apache-2.0 | 16,353; push 2026-11-20 | TS/WASM | Postgres in process, pgvector as separate package | ideas only |
| pgvector | github.com/pgvector/pgvector | PostgreSQL licence (gh api reports NOASSERTION, name "Other") | 23,760; push 2026-11-21 | C | vector type in Postgres | ideas only; not confirmed in our embedded-postgres binaries |
| Orama | github.com/oramasearch/orama | Apache-2.0 (gh api says NOASSERTION, but LICENSE.md is the Apache 2.0 text; checked 2026-11-21) | 10,618; push 2026-10-18 | TS | in-memory BM25 plus vector | ideas only (not needed; core ports the BM25 formula) |
| MiniSearch | github.com/lucaong/minisearch | MIT | 6,211; push 2025-09-16 | TS | small BM25 index, fuzzy | port the BM25 formula, or depend |
| datasketch | github.com/ekzhu/datasketch | MIT | 2,980; push 2026-10-26 | Python | reference MinHash and LSH | ideas, and oracle for research tests |
| Callidon/bloom-filters | github.com/Callidon/bloom-filters | MIT | 446; push 2026-11-15 | TS | includes MinHash | not needed; core can own about 60 lines |
| AnswerDotAI/rerankers | github.com/AnswerDotAI/rerankers | Apache-2.0 | 1,644; push 2025-12-20 | Python | unified reranker API | ideas only |
| RRF, SemDeDup, AgentIR, lexical-dense fusion | see notes | n/a | n/a | n/a | methods | port |

Not verified: hnswlib-wasm (stale, last push 2023-07), wink-bm25 (repo not found), Elasticsearch-style engines.

Model licences (HF API, re-checked in verification): bge-small-en-v1.5 MIT, gte-small MIT, nomic-embed-text-v1.5 Apache-2.0, all-MiniLM-L6-v2 Apache-2.0, bge-reranker-base MIT, Qwen3-Embedding-0.6B Apache-2.0, cross-encoder/ms-marco-MiniLM-L6-v2 Apache-2.0. The ONNX conversions that Transformers.js loads (the Xenova/ and onnx-community/ repos) carry no licence tag in the HF API; read each conversion's card and pin its revision before use. EmbeddingGemma is under the Gemma licence: not absorbable.

Literature notes written (under `.claude/worktrees/research/docs/readings/litreview/`): 2605.25092-agentir, 2606.04194-lexical-dense-fusion, 2303.09540-semdedup, 2610.07715-old-facts-return, 2509.19376-recency-prior, repo-sqlite-vec, repo-transformers-js.

## Design constraints for every plan

- Core receives vectors, never text-to-vector. An `Embedder` type `(texts, seed?) => Promise<Float32Array[]>` is injected like `ModelCall`. Model id, revision and vector hash go in the read event reason.
- Cache key: content hash + embedder id + revision (extends rules 6 and 7). Vectors committed in fixtures for tests, so no test downloads weights.
- Candidates and admission come first. Dense similarity ranks only items the read filter admitted (ADR 0009 D5 and N1 hold), so unreachable items change no score. A property test extends `read-leak.test.ts`.
- Rank fusion: RRF over rank lists is rank-based, so one item's score depends on the others. ADR 0009's pipeline scores each item alone (subset-stable). Use a weighted linear fusion of per-item components (`relevance_lexical`, `relevance_dense`, `confidence`, `recency`), which keeps subset stability, and offer RRF only as a named alternative flagged as not subset-stable. Needs an ADR amendment.
- Adding a dense component changes ADR 0009's "opt-in pipeline" and decision 41 ("any term, ranked by core"): the dense channel is a further opt-in, and the default read stays byte-identical.

## PR plans

### AB-RET-1: Policy-driven recency half-life per class, and retired-never-revived property
- goal: make the 30 day recency constant (hyperbolic, `1/(1+age/30)`, not an exponential half-life) a policy field per class (fact, preference, procedure), logged in the explanation, and prove ranking never revives a retired or superseded item.
- absorbs: recency prior (2509.19376), re-read guard (2610.07715); ideas only.
- files: `packages/core/src/plane/retrieve.ts`, `packages/core/src/schema.ts` and `packages/core/src/policy/load.ts` (policy field, schema_version bump per rule 5, so the schema change is its own PR; `RECENCY_DAYS` is a module constant in retrieve.ts today and `rankForRead` takes no policy, so the signature and the runner's C2 to C4 callers in `packages/runner` change too), `packages/core/test/property/`, ADR 0009 amendment.
- effort: S (schema PR) plus S.
- depends on: none.
- value: product, tunable freshness with a reason on every read; thesis, an ablation for the recency component and a defence against the "recency buries valid facts" objection.
- risks: schema change forces migration and fixture regeneration; changing defaults would move H1 and H2 results, so the default must keep 30 days.
- acceptance: `make test-one T=packages/core/test/property/rank-retired.test.ts` plus `make test-invariants`.

### AB-RET-2: Optional explainable hybrid tier in core (vectors in, scores out)
- goal: `retrieval: { pipeline: "core", dense: { embedder_id, weight } }`. Core receives precomputed vectors from the caller as a read-time input (a map from item id to vector, plus the query vector); `MemoryItem` is a strict object with no metadata or vector field, so storing vectors on the item would be a schema change and is not proposed. Core computes cosine, and adds a `dense` component beside the existing `relevance` (keep that name so the default read stays byte-identical; a rename to `relevance_lexical` would change every existing explanation); total is a fixed weighted sum from policy. No model call in core.
- absorbs: linear lexical-dense fusion (2606.04194), gated dense channel idea (2605.25092); BM25 formula as an optional replacement for term share (port from MiniSearch, MIT).
- files: `packages/core/src/plane/retrieve.ts`, `plane/read.ts`, the policy schema for the `retrieval.dense` option (own PR first; `Explanation.score.components` is already `z.record(z.string(), z.number())`, so new components need no schema change), `packages/core/test/unit/plane/retrieve-hybrid.test.ts`, `read-pipeline.test.ts`, ADR 0009 amendment, `docs/architecture.md`.
- effort: M.
- depends on: AB-RET-1 (policy field pattern); schema PR.
- value: product, semantic recall with every component reportable; thesis, a new H2 condition and an honest "where it helps" table.
- risks: float determinism across platforms (round components to fixed decimals, tie-break by id); subset-stability if RRF is chosen; a hybrid gain may not appear on LongMemEval-S (evidence above), which must be reported, not hidden.
- acceptance: `make test-invariants` and `make test-one T=packages/core/test/property/read-pipeline.test.ts` with a dense case (reachable-set non-interference, subset stability, identical output with the option off).

### AB-RET-3: Adapter-side embedder with a content-hash vector cache, and a flat vector index
- goal: an `Embedder` implementation using Transformers.js with bge-small-en-v1.5 (MIT) pinned by revision, a cache table keyed by (content hash, model, revision), and a flat exact index (pure TypeScript first; sqlite-vec behind a flag if `loadExtension` works on Node 24 and Windows). Supplies vectors to the plane at the boundary (pi-extension, MCP, CLI, runner).
- absorbs: Transformers.js, sqlite-vec.
- files: new `packages/embed/` (not core, not an adapter of a store), `docs/deps.md` rows (exact versions at least two weeks old: @huggingface/transformers 4.3.2 qualifies; sqlite-vec 0.1.9 qualifies), `packages/cli`, `packages/mcp` wiring, fixtures of frozen vectors.
- effort: M.
- depends on: AB-RET-2 for the consumer.
- value: product, local semantic search with no Docker and no API key; thesis, reproducibility via frozen vectors.
- risks: model download needs network once; ONNX numeric drift across OS (mitigate with fixtures and rounding); install size and native binaries; Gemma-licensed models must be excluded; import rule (the package must not be imported by core or by adapters that core tests use). Weight hashes must be pinned in `docs/deps.md`.
- acceptance: `make test-one T=packages/embed/test/cache.test.ts` (second run makes zero embed calls, a model revision change misses) and `engram doctor` reports the embedder pin.

### AB-RET-4: Semantic near-duplicate lint, model-based tier
- goal: a lint `semantic-duplicate` over one scope and class: cluster by embedding, compare within clusters, flag pairs above a policy threshold; finding carries cosine, threshold, embedder id and revision. Advisory only. Reported as the model-based tier (ADR 0018 and 0008), vectors supplied at the boundary, so core stays pure.
- absorbs: SemDeDup (2303.09540).
- files: `packages/core/src/lint/model.ts` or a new `lint/semantic.ts`, `plane/lint.ts`, policy lint config, `packages/core/test/unit/lint/`, fault fixtures in `fixtures/faults/model`, a scripted-vector fixture, ADR 0018 amendment.
- effort: M.
- depends on: AB-RET-3 (or scripted vectors for tests); AB-RET-5 shares the report shape.
- value: product, catches paraphrased duplicates MinHash misses; thesis, an L3-style variance and precision table.
- risks: ADR 0018 allows embedding similarity only through a store's `native_search`, reported as model-based, and `MODEL_LINT_IDS` and `LINT_THRESHOLD_KEYS` in `packages/core/src/lint.ts` hold only `contradiction`, `unsupported-claim` and the `near-duplicate` key (reserved for MinHash), so a new lint id and a second threshold key need an ADR amendment first; a paraphrase and a contradiction can score alike (the lint must not claim they are the same fact); thresholds do not transfer between models; must stay inside readable scope (lint-leak property).
- acceptance: a new fixture config beside `research/configs/l3-lint-fixture.json` (that config replays model cassettes, and this lint takes vectors, not a `ModelCall`, so it cannot reuse it unchanged) with scripted vectors, plus `make test-one T=packages/core/test/property/lint-leak.test.ts`.

### AB-RET-5: MinHash near-duplicate lint (the deterministic form ADR 0018 names)
- goal: implement what ADR 0018 promised and card L1 deferred (the `near-duplicate` threshold key already exists in `LINT_THRESHOLD_KEYS` and is validated by `policy/load.ts`, so no schema change; the extension point is `duplicates()` in `packages/core/src/lint/det.ts`, the existing `duplicate` lint, active only when that threshold is set): word-shingle MinHash with a fixed seed and threshold, deterministic, no embeddings. Estimated Jaccard in the finding.
- absorbs: MinHash method; datasketch (MIT) as test oracle in `research/`; no TypeScript dependency (about 60 lines in core with a seeded hash).
- files: `packages/core/src/lint/det.ts`, new `packages/core/src/lint/minhash.ts`, `packages/core/test/unit/lint/minhash.test.ts`, fixtures, `docs/log` entry.
- effort: S.
- depends on: none.
- value: product, cheap near-duplicate detection in the deterministic tier; thesis, completes the H3 floor for the duplicate class.
- risks: default behaviour must stay byte-identical when the threshold is unset, so the committed `duplicate` fixtures and H3 floor do not move; short memory items give noisy Jaccard (use character shingles under a length); threshold must be set from the L2 set, not chosen by hand.
- acceptance: `make test-one T=packages/core/test/unit/lint/minhash.test.ts` and `make test-repro` for the H3 floor staying byte-stable unless the new lint is enabled.

### AB-RET-6: Retrieval explanation views and a recall ablation harness
- goal: show hybrid components in the inspector and `engram explain`, and add a runner condition and research script that compares lexical, dense, hybrid on the fixture-size LongMemEval and GateMem sets with bootstrap intervals.
- absorbs: AgentIR and lexical-dense fusion protocols (per-benchmark reporting).
- files: `packages/server` route table (regenerate with `make api`), `packages/ui/src`, `packages/runner`, `research/scripts/`, `research/configs/`, `research/results/MANIFEST.md`, preregistration amendment (rule: nothing not in `docs/research/preregistration.md`).
- effort: M.
- depends on: AB-RET-2 and AB-RET-3.
- value: product, the inspector shows why an item ranked; thesis, the evidence for or against a vector tier.
- risks: prereg must be amended before any run; cassette cost for new conditions; claims limited to what the data shows.
- acceptance: `make bench BENCH=longmemeval` on the new config, then `make test-repro`.

### AB-RET-7 (optional, deferred): local cross-encoder reranker as a boundary step
- goal: rerank the admitted top-k with ms-marco-MiniLM-L6 (Apache-2.0) in the runner or extension, passing scores to core as one more named component.
- absorbs: Transformers.js reranking; ideas from rerankers.
- files: `packages/embed/`, extension wiring.
- effort: M.
- depends on: AB-RET-3.
- value: possible precision; thesis only if measured.
- risks: 2606.04194 reports an off-the-shelf reranker lowering Hit@1 by 6.9 pp in one configuration; explainability weak (opaque score). Do only after AB-RET-6 shows headroom.
- acceptance: AB-RET-6's harness with the reranker condition shows a gain with an interval excluding zero.

## Recommended order

1. AB-RET-5 (MinHash lint): smallest, closes a documented gap in ADR 0018, entirely deterministic and inside the thesis-critical core.
2. AB-RET-2 (hybrid tier in core, vectors in): the central product piece, and it only needs scripted vectors to be built and tested, so it can start before the embedder exists.
3. AB-RET-3 (embedder and cache): makes the hybrid tier usable and unlocks AB-RET-4 and AB-RET-6. AB-RET-1 can run alongside as a small policy change.

Open items for the lead: whether to allow a new `packages/embed` (it needs a line in AGENTS.md "Where things live"), and whether the dense channel needs a preregistered amendment before any claim is made.

## Verification (2026-11-21)

Checked with `gh api`, `npm view`, the Hugging Face API and the arXiv API and abs pages.

Checked and confirmed: licence, stars and last push of all 13 repos in the landscape table (numbers matched exactly); npm versions and licences of @huggingface/transformers 4.3.2 (Apache-2.0, modified 2026-10-30), fastembed 3.0.0 (MIT) and sqlite-vec 0.1.9 (MIT OR Apache); the six model licences; EmbeddingGemma under the Gemma licence (not absorbable); arXiv ids 2605.25092, 2606.04194, 2303.09540 and 2610.07715 resolve to the claimed titles and authors; the 8.8 to 17.2 point, 6.9 pp and LongMemEval-S claims of 2606.04194 and the 98.5, 10.8, 88.5, 97.7 and 0.8 figures of 2610.07715 match their abstracts; code URL github.com/Chrislysen/opsem exists; ADR 0018 and card L1 did leave MinHash unbuilt (no minhash in `packages/`).

Corrected:
- fastembed-js: the GitHub repository is archived (read-only). Downgraded from "depend (alternative)" to ideas only.
- Orama: gh api says NOASSERTION, but LICENSE.md is the Apache 2.0 text. Row corrected; still ideas only (not needed).
- sqlite-vector: LICENSE.md is the plain Apache 2.0 text; the "terms not read" caveat removed.
- arXiv 2509.19376: the current title is "Freshness and the Limits of Heuristic Trend Detection in Temporal RAG"; the litreview note used the v1 title. The note's title now gives both.
- Recency: `retrieve.ts` computes `1/(1+ageDays/30)`, which is hyperbolic (0.5 at 30 days), not an exponential half-life. Wording fixed in the summary and AB-RET-1.
- Evidence on dense retrieval conflicts: AgentIR reports BM25 alone strongest on LoCoMo, against the fusion gain in 2606.04194. Summary says so.
- AB-RET-2: `Explanation.score.components` is already `z.record(z.string(), z.number())`, so adding a component needs no schema PR; and `MemoryItem` is a strict object with no metadata field, so "vectors from item metadata" was infeasible without a schema change. Vectors now enter as a read-time input map. The existing component is `relevance`, kept so the default read is byte-identical.
- AB-RET-4: the acceptance command replayed model cassettes and cannot cover a vector lint; replaced by a new fixture config. ADR 0018 limits embedding similarity to a store's `native_search`, and lint ids live in `packages/core/src/lint.ts`; both need amending first.
- AB-RET-5: the `near-duplicate` threshold key already exists, so no schema change; the extension point is `duplicates()` in `lint/det.ts`.
- AB-RET-1: `rankForRead` takes no policy and is also called by the runner's C2 to C4, so the change reaches `packages/runner`.
- ms-marco-MiniLM-L6 licence (Apache-2.0) verified for the original model; the Xenova ONNX conversions carry no licence tag in the API and must be checked before pinning.

Refuted: no headline claim; the corrections above are to detail.

Not verified: that sqlite-vec loads under `node:sqlite` (`allowExtension`) on Node 24 and Windows; that pgvector is absent from the embedded-postgres binaries; hnswlib-wasm and wink-bm25 status.

Plan verdicts: AB-RET-1 keep-with-fix, AB-RET-2 keep-with-fix, AB-RET-3 keep-with-fix, AB-RET-4 keep-with-fix, AB-RET-5 keep, AB-RET-6 keep-with-fix, AB-RET-7 drop (deferred; it rests on one contrary result and has no measured headroom; revisit after AB-RET-6).

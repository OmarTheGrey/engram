# 05 Hygiene: contradiction, staleness, entity resolution, fact checking, consolidation

## Executive summary

Engram's lint tiers are a six-lint deterministic floor and a model tier (contradiction, unsupported-claim) that pairs items by term overlap. The study of MemStrata (note 2606.26511) says key extraction covers about 44 percent of messy prose. The best moves are: (1) a local NLI tier (DeBERTa-v3 cross-encoder through ONNX in Node) that sits between the deterministic and model tiers, is free to run, and removes most model calls; (2) an entity-keyed fact table filled first by structural extractors (tool results, config keys, versions) and then by a model, with keyed and unkeyed always reported apart; (3) a supersession helper ported from the deterministic half of Graphiti's invalidation, which proposes `valid_to` and never applies it silently; (4) a consolidation job that is off by default, dedup-first, and produces only candidates, because 2026 evidence (NeurIPS workshop paper, 2605.08538, FadeMem) shows LLM summaries often degrade memory. All absorbable candidates below are MIT, Apache-2.0 or BSD. Everything heavy is Python, so in the product we port ideas or depend on the ONNX route. Not verified: ONNX parity of MiniCheck, byte-identical NLI output across CPUs, and every number I cite from abstracts only.

## Landscape

Stars and last push from `gh api` on 2026-11-21 unless stated. Hub facts from the Hub API.

| Name | URL | Licence | Stars, last activity | Lang | What it gives us | Mode |
|---|---|---|---|---|---|---|
| transformers.js (@huggingface/transformers 4.3.2) | github.com/huggingface/transformers.js | Apache-2.0 | 16,439; 2026-11-18 | JS | NLI pipeline in Node | depend (optional peer, outside core) |
| onnxruntime-node 1.31.1 | npm | MIT (npm field) | repo is microsoft/onnxruntime, not checked (gh 404 on the slug tried), stars unverified | C++/JS | CPU inference | depend |
| cross-encoder/nli-deberta-v3-small and -base | huggingface.co | Apache-2.0 (tag), onnx tag | 332,873 and 216,323 downloads | model | 3-way NLI | depend, pinned by sha256 |
| MoritzLaurer DeBERTa-v3-base-mnli-fever-anli, deberta-v3-large-zeroshot-v2.0 | huggingface.co | MIT (tag) | 206,157 and 143,878 downloads | model | NLI, zero-shot | ideas only (the ANLI training data is believed NC, not verified; the Hub tag says MIT, so treat as unresolved and not absorbable until the data licence is read) |
| MiniCheck | github.com/Liyan06/MiniCheck | Apache-2.0 | 235; 2025-08-27 | Python | support checker; Flan-T5-Large model MIT | depend (research); port not verified |
| AlignScore | github.com/yuh-zha/AlignScore | MIT | 179; 2024-03-11 | Python | support score | ideas, baseline |
| FActScore | github.com/shmsw25/FActScore | MIT | 465; 2025-04-13 | Python | atomic-claim scoring | ideas (claim decomposition) |
| SAFE / long-form-factuality | github.com/google-deepmind/long-form-factuality | NOASSERTION (not verified) | 698; 2026-06-18 | Python | search-augmented checking | ideas only until licence read |
| ragas / deepeval / trulens | vibrantlabsai/ragas (renamed from explodinggradients/ragas), confident-ai/deepeval, truera/trulens | Apache-2.0, Apache-2.0, MIT | 16,393; 19,582; 3,664, all active Nov 2026 | Python | faithfulness metrics | ideas; research baselines only |
| Graphiti | github.com/getzep/graphiti | Apache-2.0 | 32,972; 2026-11-20 | Python | edge dedupe and invalidation | port (interval logic) |
| letta sleep-time-compute | github.com/letta-ai/sleep-time-compute | MIT | 145; 2025-04-30 | Python | offline compute idea | ideas |
| LightMem | github.com/zjunlp/LightMem | MIT | 1,228; 2026-11-17 | Python | sleep-time update; not read | ideas |
| MemoryBank | zhongwanjun/MemoryBank-SiliconFriend | MIT | 456; 2023-05-24 | Python | Ebbinghaus forgetting | ideas |
| RapidFuzz, dedupe, splink | rapidfuzz/RapidFuzz, dedupeio/dedupe, moj-analytical-services/splink | MIT, MIT, MIT | 4,214; 4,531 (2025-07-29); 2,592 | Python | record linkage | ideas; JS side needs a small port |
| recordlinkage / zingg | J535D165/recordlinkage, zinggAI/zingg | BSD-3, AGPL-3.0 | 1,065 (2024-02-21); 1,275 | Python, Java | linkage | recordlinkage ideas; **zingg not absorbable** |
| GLiNER and GLiNER2 | urchade/GLiNER, fastino-ai/GLiNER2 | Apache-2.0 | 4,284; 2,490, active | Python | schema-driven entity and relation extraction; npm `gliner` 0.0.19 (MIT, 2025-03, tiny) | ideas; ONNX route unverified |
| compromise, wink-nlp | spencermountain/compromise, winkjs/wink-nlp | MIT | 12,176 (active); 1,391 (2026-05) | JS | rule-based entities, dates | depend (structural extractors) |
| instructor, dspy | 567-labs/instructor, stanfordnlp/dspy | MIT | 14,130; 39,163 | Python | typed LLM extraction | ideas |

Methods and papers (see notes): MELD 2608.16357 (NLI plus claim-key merge gate), HallDetect 2608.05823 (arXiv title "Decomposed Entailment for Factuality Checking and Hallucination Detection"; HallDetect is its method name; atomic-claim entailment with a small encoder; abstract read, no code listed), Human-Inspired Memory 2605.08538, FadeMem 2601.18642, "Useful Memories Become Faulty" (NeurIPS 2026 workshop), Sleep-time Compute 2504.13171, MiniCheck 2404.10774, AlignScore 2305.16739. STALE, MemStrata and Zep are already in the litreview.

Notes written (in the research worktree's litreview folder): 2404.10774-minicheck, 2305.16739-alignscore, 2608.16357-meld, 2605.08538-human-inspired-memory, 2601.18642-fademem, 2504.13171-sleep-time-compute, useful-memories-faulty-neurips2026, repo-graphiti-edge-invalidation, repo-nli-onnx-stack.

Caveat on all paper notes: only abstract pages were read (some through a summarising fetch). They state this and carry no invented numbers.

## PR plans

### AB-HYG-1: Local NLI contradiction lint (tier 1.5)
- **goal:** a third contradiction tier that scores each candidate pair with a pinned local NLI cross-encoder, flags above a policy threshold, and sends only the uncertain band to the model lint.
- **absorbs:** cross-encoder/nli-deberta-v3-small (Apache-2.0) through transformers.js or onnxruntime-node; MELD's NLI-as-merge-signal; FadeMem's four-way relation labels as a later extension.
- **files:** `packages/core/src/lint/nli.ts` and `packages/core/test/unit/lint/nli.test.ts` (pairing reuses `model.ts` neighbours; the scorer is an injected `NliScore` function, so core imports nothing), `packages/core/src/lint.ts` (new lint id or tier flag, a threshold key), `packages/model/` or a new `packages/nli/` (the ONNX scorer, model sha256 pin, a cache keyed on model hash, runtime version and pair hash, rules 6 and 7), `docs/deps.md`, `packages/bench/PINS.md` entry, ADR amending 0008, `research/configs/` and `research/scripts/` for the H3 delta.
- **effort:** L (a new package or ONNX scorer, pin, ADR, config, script; not M).
- **depends on:** L3 (merged); the L2 fault set.
- **value:** product, a contradiction check with no API cost, offline, usable on the free tier. Thesis: H3 gets a middle tier, with precision and recall per class, and "model calls saved" as a cost result.
- **risks:** licence of training data (prefer MNLI/SNLI only models, state it); float nondeterminism across CPUs; native binary install weight on Windows; NLI misses subtle contradictions (MELD names this), so report recall; transformers.js fetches weights at run time, so vendor and hash them.
- **acceptance:** `make test-one T=packages/core/test/unit/lint/nli.test.ts` with a scripted scorer, and `make run CONFIG=research/configs/h3-lint-nli.json` replaying cassettes with zero new calls, then `uv run python research/scripts/h3_lint_delta.py` reporting NLI against the model tier.

### AB-HYG-2: Entity-keyed fact table
- **goal:** a plane-owned table of (subject, relation, value, item id, valid_from) so that contradiction and supersession key on structure first, and the share of items keyed becomes a measured quantity (the 44 percent problem).
- **absorbs:** MemStrata's key idea (already in litreview); Graphiti's typed edges; rule-based extractors (compromise) for dates and versions; GLiNER2 and a schema-driven model extractor as the optional second tier (ideas, not a dependency).
- **files:** `packages/core/src/schema.ts` (an optional `fact` field or a side table; rule 5 means this is its own schema PR with `schema_version`, migration, `make api`, fixtures and nothing else), `packages/core/src/facts.ts` (normalise, match, conflict on same subject and relation with different value), `packages/core/src/lint/keyed.ts` (deterministic keyed-conflict lint), `packages/pi-extension` (structural extractors on tool results: file paths, package versions, config keys), `research/scripts/h3_fault_set.py` for keyed/unkeyed coverage.
- **effort:** L, split into a schema PR and a lint PR.
- **depends on:** ADR amending 0002; none of the other plans.
- **value:** deterministic contradiction and supersession for a large share of tool-derived memories; thesis: raises the keyed share H3 reports and makes the keyed/unkeyed split a result, not a caveat.
- **risks:** the schema PR rule; extractor errors create false conflicts, so a keyed conflict is `warn`, never retires; entity resolution of subjects ("Postgres" vs "PostgreSQL") needs a small alias table (RapidFuzz-style similarity ported, or a per-scope alias map) and will be the main source of misses. No licence issue (all MIT or Apache-2.0).
- **acceptance:** `make api-check` clean, `make test-one T=packages/core/test/unit/lint/keyed.test.ts`, and a report from `research/scripts/h3_fault_set.py` showing keyed coverage on the fault set.

### AB-HYG-3: Supersession helper that proposes valid_to
- **goal:** a pure function that, given a new item and candidate old items (from the keyed table, the NLI tier or the model lint), returns proposed `valid_to` updates and a review flag, plus a CLI and MCP surface to apply a proposal as a governed update event.
- **absorbs:** Graphiti `_apply_temporal_invalidation` and `resolve_edge_contradictions` (Apache-2.0), ported from a summarised read; re-read the source before porting.
- **files:** `packages/core/src/supersede.ts`, `packages/core/test/supersede.test.ts`, `packages/core/test/property/invariants.test.ts` (a property: a proposal never widens a window and never retires an item the actor cannot reach), `packages/cli` and `packages/mcp` (propose and apply commands, calling the generated client), `docs/decisions/` ADR amending 0005.
- **effort:** S to M.
- **depends on:** none hard; more useful after AB-HYG-2.
- **value:** product, stale-fact handling with a visible reason; thesis: connects to STALE's three probes (the explanation carries the superseding id) and a new "proposals accepted" measure.
- **risks:** Graphiti expires the new edge when a candidate starts later, which in Engram must be a review case, not an automatic retire; wrong `valid_at` inputs give wrong windows.
- **acceptance:** `make test-invariants` including the new properties, plus `make test-one T=packages/core/test/supersede.test.ts`.

### AB-HYG-4: Consolidation and summarisation job under governance
- **goal:** an opt-in job (off by default) that merges exact and near duplicates and writes a summary as a candidate item with lineage to its sources, which then passes the unsupported-claim lint and, for procedures, replay, before it becomes active. Sources are retained, never retired by the summary alone.
- **absorbs:** dedup-first consolidation (2605.08538), the "gate consolidation, keep raw episodes" finding (NeurIPS workshop paper), sleep-time scheduling (2504.13171), MinHash near duplicates already in ADR 0018.
- **files:** `packages/core/src/consolidate.ts` (selection and merge rules, no model), `packages/core/src/lint/` (reuse unsupported-claim on summaries), `packages/runner` (the seeded, cached summariser behind an injected ModelCall), `packages/cli` (`engram consolidate --scope`), policy keys, `research/configs/` for a long-horizon arm.
- **effort:** L.
- **depends on:** L1 near-duplicate form (ADR 0018 says it was not in L1), L3, ADR 0010 and 0025.
- **value:** product, store growth control; thesis: a measured test of whether governed consolidation avoids the degradation the workshop paper reports.
- **risks:** summary faults; the evidence says to default to off; no code available for the 2026 papers, so nothing reproduces; cost.
- **acceptance:** `make test-invariants` (consolidation never loses a source and never raises a grant), and `make run CONFIG=research/configs/ab-hyg-consolidation.json` replayed from cassettes.

### AB-HYG-5: Support scoring for the unsupported-claim lint
- **goal:** a research-side comparison of MiniCheck-Flan-T5-Large and AlignScore against the model lint on the L2 fault set, deciding whether an ONNX port is worth doing.
- **absorbs:** MiniCheck (Apache-2.0, model MIT), AlignScore (MIT).
- **files:** `research/scripts/ab_hyg_support_check.py`, `research/configs/ab-hyg-support.json`, `research/results/` (with MANIFEST row), `docs/log/`.
- **effort:** S to M.
- **depends on:** the L2 fault set; Python deps in `pyproject.toml` with a `docs/deps.md` row (torch is heavy).
- **value:** thesis, a baseline row and a cost comparison; product only if a port follows.
- **risks:** no ONNX export verified; torch install size; transfer to short memory items unproven.
- **acceptance:** `make test-repro` with the new MANIFEST row.

### AB-HYG-6: Decay-ordered eviction score
- **goal:** an explainable retention component (age, access count, relevance) that orders eviction candidates, shown in the explanation.
- **absorbs:** FadeMem and MemoryBank ideas.
- **files:** `packages/core/src/plane/retention.ts`, tests, an ADR amending 0025.
- **effort:** M.
- **depends on:** E2.4 (merged).
- **value:** a long-horizon arm result; risks: dropping rare critical items; invariant five must hold.
- **acceptance:** `make test-invariants` and a long-horizon comparison script.

## Recommended order

1. **AB-HYG-3** (supersession helper): smallest, deterministic, fits the rules today, and gives the thesis a STALE-linked result.
2. **AB-HYG-1** (local NLI tier): biggest cost and offline value, and the thesis H3 gets a new tier; do the pin and determinism check first.
3. **AB-HYG-2** (fact table): the largest effect on keyed coverage, but it needs the schema-only PR, so start its ADR now and land it after the first two.

Consolidation (AB-HYG-4) should wait, given the evidence it can hurt.

## Verification (2026-11-21)

Checked with `gh api`, `npm view`, the Hub API, arxiv.org abs pages and the repository.

**Confirmed.** Licence, stars and last push for every GitHub repo in the Landscape table match `gh api` (transformers.js 16,439; MiniCheck 235; AlignScore 179; FActScore 465; SAFE NOASSERTION 698; deepeval 19,582; trulens 3,664; graphiti 32,972; sleep-time-compute 145; LightMem 1,228; MemoryBank 456; RapidFuzz 4,214; dedupe 4,531; splink 2,592; recordlinkage 1,065; zingg AGPL-3.0 1,275; GLiNER 4,284; GLiNER2 2,490; compromise 12,176; wink-nlp 1,391; instructor 14,130; dspy 39,163). npm: transformers 4.3.2 Apache-2.0 (published 2026-10-27, over two weeks old), onnxruntime-node 1.31.1 MIT, gliner 0.0.19 MIT. Hub: both cross-encoder NLI models Apache-2.0 with an onnx tag, trained on MultiNLI and SNLI per the card; MoritzLaurer models MIT by tag, the base one trained on ANLI. MiniCheck-Flan-T5-Large MIT by tag. arXiv ids 2404.10774, 2305.16739, 2608.16357, 2608.05823, 2601.18642, 2605.08538, 2504.13171 and 2606.26511 resolve to the claimed titles. Graphiti `_apply_temporal_invalidation` (line 762) and `resolve_edge_contradictions` (line 795) exist. The NeurIPS 2026 page for "Useful Memories Become Faulty" resolves; it is a workshop page, not an arXiv paper. All nine notes have correct frontmatter id, title and code URL, and contain no U+2014.

**Corrected.** ragas lives at vibrantlabsai/ragas now (the old slug redirects). The onnxruntime row no longer implies a verified repo. The ANLI licence claim is marked unresolved rather than asserted. HallDetect's arXiv title added. Test paths fixed: tests live in `packages/core/test/unit/lint/` and invariants in `packages/core/test/property/invariants.test.ts`, there is no `test/lint/` or `test/invariants/` directory. AB-HYG-1 effort raised from M to L. SAFE stays ideas only (NOASSERTION). zingg stays not absorbable (AGPL-3.0). FADE and MELD code and licence were never checked.

**Refuted or overlapping.**
- AB-HYG-6 duplicates ADR 0025: eviction already orders by `recency` (seq of last change) and `utility` (count of read events naming the item, derived from the log). Age and access count exist; there is no relevance signal without a model. Dropped.
- The report's "keyed" (entity-keyed fact) collides with the existing H3 meaning (`keyed` in `packages/bench/src/faults/labels.ts`: a fault detectable from a structural field such as valid_to). AB-HYG-2 must use another name (for example "fact-keyed") or the H3 tables become ambiguous.
- Supersession already exists as lineage (`packages/core/src/items.ts`: a new version lists the ids it supersedes) and as promotion's `superseded` retire. AB-HYG-3 only adds proposals of `valid_to`, which is not built; it must interoperate with lineage.
- The near-duplicate (MinHash) form of the `duplicate` lint is not built (ADR 0018, L1 amendment), so AB-HYG-4 depends on a card that does not exist yet.
- The 44 percent key coverage figure comes from note 2606.26511, which was read from its abstract and HTML only.

**Rules.** No plan breaks rule 1 if the NLI scorer is injected (`NliScore`) and ONNX lives outside core. AB-HYG-1 needs scores cached by (model sha256, runtime version, pair hash) and committed as cassettes, because ONNX float output may differ across CPUs and CI runs offline (rules 6 and 7); weights must be fetched once and pinned, never fetched in `make test`. A new `packages/nli` needs `pnpm-workspace.yaml`, the AGENTS.md package table and `docs/deps.md` in the same PR.

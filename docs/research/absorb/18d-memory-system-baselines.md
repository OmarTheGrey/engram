# 18d Memory-system baselines, and governed forgetting and consolidation (gap agent, AB-GAP4)

## Executive summary

Engram already adapts Mem0 and Letta (MemFS), and the litreview already holds notes for Zep, A-Mem, MemOS, Mem0 v3, Supermemory, Sleep-time Compute, FadeMem, Human-Inspired Memory and MemForm. What is missing is a decision on which systems serve as comparison arms and what it costs to sit them behind the Adapter contract. The finding: the architectures that matter are Python servers or hosted APIs whose internal LLM calls Engram cannot cache (rules 6 and 7), so running them upstream offline is not feasible without a model-call proxy (MP-17). The cheapest honest route has two parts. First, keep Mem0 and Letta as the real wrapped stores (done). Second, add other architectures as scripted algorithm ports (A-Mem note linking, MemoryOS tiering, Letta sleep-time rewriting), labelled "algorithm re-implementation", never as the upstream product. For forgetting and consolidation, ADR 0010 and 0025 already give retire-never-delete, utility and recency. The missing first-class pieces are a deterministic decay score that demotes and proposes retirement, and a consolidation job that writes a candidate with source lineage. The latter needs a schema field, because `lineage` in `schema.ts` today means superseded versions, not sources. Not verified: A-Mem repo stats (the GitHub API timed out), any upstream licence beyond the table, whether a proxy can intercept Python-side calls, and every paper claim beyond abstracts. No new literature notes were written: the candidates already have notes and I did not read further sources deeply enough to add honest ones.

## Landscape (gh api, 2026-11-21 unless stated)

| Name | URL | Licence | Stars, last push | Lang | Gives us | Offline from cassettes? | Mode |
|---|---|---|---|---|---|---|---|
| Mem0 | github.com/mem0ai/mem0 | Apache-2.0 | 69,296; 2026-11-18 | Py, TS | already adapted, in process | yes with infer:false | already depend |
| Letta | github.com/letta-ai/letta | Apache-2.0 | 25,506; 2026-10-18 | Py server | already adapted via MemFS git | adapter yes, agent loop no | already depend |
| Letta sleep-time-compute | github.com/letta-ai/sleep-time-compute | MIT | 145; 2025-04-30 (from existing note) | Py | offline rewriting idea | method only | ideas |
| Graphiti and Zep | github.com/getzep/graphiti, getzep/zep | Apache-2.0 both | 32,972; 5,011 | Py | temporal graph baseline | needs a graph DB server, LLM calls inside | ideas, optional external arm |
| MemOS | github.com/MemTensor/MemOS | Apache-2.0 | 12,469; 2026-11-20 | TS and Py (GitHub reports TS) | memory OS with provenance | internal LLM calls uncached | ideas, possible HTTP arm |
| MemoryOS | github.com/BAI-LAB/MemoryOS | Apache-2.0 | 1,627; 2026-07-07 | Py | short, mid, long tiering with heat score | LLM inside | port the tiering idea |
| MIRIX | github.com/Mirix-AI/MIRIX | Apache-2.0 | 3,508; 2026-11-11 | Py | six memory types | LLM inside, not read | ideas only |
| Supermemory | github.com/supermemoryai/supermemory | MIT | 31,680; 2026-11-21 | TS | hosted API plus local mode, SDK | hosted no; local unverified | adapter spike |
| A-Mem | github.com/WujiangXu/A-mem-sys (from note) | not re-verified | unverified | Py | note linking and evolution | LLM inside | port the algorithm |
| LightMem | github.com/zjunlp/LightMem | MIT | 1,228; 2026-11-17 | Py | sleep-time update | LLM inside | ideas |
| FadeMem 2601.18642, Human-Inspired 2605.08538 | arXiv | no code listed | n/a | n/a | decay, dedup-first consolidation | method | port as policy |
| MemForm 2610.14431 | github.com/opanhw/memform-code | MIT | 2; 2026-11-14 | Py | formation-poisoning arms | n/a | already planned (MP-28) |

Memento-style procedural memory: no repository verified in this pass. Distill already covers procedures (AWM, ReasoningBank, SkillWeaver notes exist), so treat it as covered.

## Offline feasibility, by what an adapter needs

The Adapter contract (`packages/core/src/adapter.ts`, capabilities including `native_history`) is a store interface, and ADR 0035 makes policy equivalence the H4 claim. A baseline behind the contract must expose write, search, retire and history with ids Engram assigns, and make every internal LLM call cacheable. Mem0 meets the second condition only with `infer:false`. A Python server meets it only if its provider base URL can point at the cassette proxy (MP-17). Rule: an upstream system is a baseline arm only if its model base URL is overridable; otherwise it is an ideas-only port.

## PR plans

### AB-GAP4-1: Memory-system baseline matrix and prereg proposal
- **goal:** name, per candidate, its arm role (wrapped store, ungoverned native C2, or algorithm port), licence, offline route and the H1 or H2 claim it could test, plus a prereg amendment proposal merged into MP-09's batch.
- **absorbs:** the table above; Mem0 and Letta as the only wrapped stores; A-Mem, MemoryOS and sleep-time as ports.
- **files:** `docs/research/preregistration.md` (proposal), `docs/decisions/00NN-baseline-arms.md`, `docs/research/baseline-matrix.md`.
- **effort:** S. **depends on:** MP-09.
- **value:** product, honest positioning. Thesis, a defensible answer to "compared against what".
- **risks:** claiming to beat a product when only a re-implementation ran, so every arm is labelled. A-Mem licence unverified.
- **acceptance:** `make lint-docs`.

### AB-GAP4-2: Algorithm-port baselines over the files adapter (A-Mem links, MemoryOS tiers)
- **goal:** two scripted, seeded policies in `packages/bench` that reproduce write-time linking and tier promotion through the injected ModelCall, run as H2 arms on LongMemEval fixtures.
- **absorbs:** A-Mem (2502.12110); MemoryOS heat-score tiering (Apache-2.0, idea not code).
- **files:** `packages/bench/src/baselines/amem.ts`, `memoryos.ts`, tests and cassettes, `research/configs/h2-baselines-*.json`, `research/scripts/h2_baselines.py`, MANIFEST row.
- **effort:** L. **depends on:** AB-GAP4-1, MP-17.
- **value:** thesis, arms richer than Mem0 alone and replayable offline. No direct product value.
- **risks:** fidelity disputes; label as re-implementation; check A-Mem licence before reading its code.
- **acceptance:** `make run CONFIG=research/configs/h2-baselines-fixture.json` replays with zero new calls.

### AB-GAP4-3: External store sidecar adapter harness (HTTP or stdio)
- **goal:** a generic adapter for a local process (MemOS, a Graphiti REST wrapper, Supermemory local) that passes the conformance suite, with the process's model base URL pointed at the cassette proxy.
- **absorbs:** MemOS and Zep as optional external arms; no vendoring.
- **files:** `packages/adapters/src/sidecar/`, a new conformance case, `docs/deps.md` if a client is added.
- **effort:** L. **depends on:** MP-17, AB-GAP4-1.
- **value:** product, a path to any HTTP memory store. Thesis, breadth only if ADR 0035 allows.
- **risks:** hosted calls cannot be intercepted; some need a graph DB and no Docker is allowed; drop if the first spike fails.
- **acceptance:** `make test-one T=packages/adapters/test/sidecar/sidecar.test.ts` against a fake sidecar.

### AB-GAP4-4: Governed decay (policy key `retention.decay`)
- **goal:** a pure evaluator computing a strength per item from log-derived utility, recency and class (exponential decay with a per-class half-life, no model). It lowers read-rank weight with the components shown in the explanation and proposes retirement below a floor through the existing sweep. It never deletes and never touches `valid_to`.
- **absorbs:** FadeMem (2601.18642) decay shape; ADR 0025's utility and recency; MemoryBank Ebbinghaus idea (MIT, ideas).
- **files:** `packages/core/src/policy/decay.ts`, a hook in `policy/retention.ts`, the policy key (its own schema PR if versioned), `packages/core/test/property/invariants.test.ts` (never deletes, never raises a grant, monotone in age), an ADR amending 0025.
- **effort:** M. **depends on:** ADR 0025 (merged); MP-14 if the policy schema changes.
- **value:** product, growth control with explainable ranking. Thesis, an H3-adjacent measured comparison against fixed TTL.
- **risks:** the budgeted-memory result (ADR 0010) favours never evicting, so default is demote only and sweep proposals use the `manual` rule; half-lives are untuned, so report a sensitivity table.
- **acceptance:** `make test-invariants` and `make test-one T=packages/core/test/unit/policy/decay.test.ts`.

### AB-GAP4-5: Consolidation with source lineage (schema PR, then job)
- **goal:** PR A (schema only, rule 5): an optional `derived_from` id list on items, so a summary cites the items it merges. PR B: `Plane.consolidate(actor, scope)` merges exact duplicates deterministically and accepts summary candidates from an injected ModelCall, each admitted as `candidate` with `derived_from`, retiring no source.
- **absorbs:** Human-Inspired Memory dedup-first (2605.08538); the workshop finding that LLM summaries degrade memory; Letta sleep-time scheduling (2504.13171). Supersedes the AB-HYG-4 backlog entry by splitting it.
- **files:** `packages/core/src/schema.ts` (PR A), migration, fixtures, `make api`; `packages/core/src/plane/consolidate.ts`, `packages/cli`, `packages/pi-extension`, tests.
- **effort:** L (two PRs). **depends on:** MP-11 (MinHash duplicates), MP-14.
- **value:** product, growth control with an audit trail, and explain shows sources. Thesis, tests whether governed consolidation avoids the reported degradation.
- **risks:** summary faults pass the lint; cost; off by default; no upstream code to reproduce.
- **acceptance:** `make test-invariants` (a source is never lost, a summary never has a wider grant than its narrowest source) and `make api-check`.

### AB-GAP4-6: Sleep-time consolidation scheduler
- **goal:** run AB-GAP4-5's job on idle in the pi extension and runner, seeded and cached, writing only candidates.
- **absorbs:** sleep-time compute (2504.13171).
- **files:** `packages/pi-extension/src/`, `packages/runner/`, a config and a script.
- **effort:** M. **depends on:** AB-GAP4-5.
- **value:** thesis, an amortised-cost result.
- **risks:** idle trigger flakiness; the cassette key must include the job input hash.
- **acceptance:** `make run CONFIG=research/configs/ab-gap4-sleeptime-fixture.json` replayed.

### AB-GAP4-7: Supermemory adapter spike
- **goal:** decide whether the MIT TypeScript SDK or its local mode runs offline; if so, a thin wrapper that writes imports with provenance `external`.
- **absorbs:** the repo-supermemory note.
- **files:** a spike memo in `docs/research/`, optionally `packages/adapters/src/supermemory/`.
- **effort:** S. **depends on:** AB-GAP4-1.
- **value:** product, a popular TypeScript store. **risks:** hosted only; core licence unverified.
- **acceptance:** the memo plus `make lint-docs`.

## Recommended order
1. AB-GAP4-1, cheap, and it settles the comparison question before any code.
2. AB-GAP4-4, governed decay: small, pure core, fits ADR 0010, 0025 and the invariants.
3. AB-GAP4-5, consolidation with lineage: the schema piece unblocks the rest; AB-GAP4-2 follows once MP-17 exists.

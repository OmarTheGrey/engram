# Baselines: memory architectures Engram could be compared against

Written by card R2 of the absorb plan (`docs/tasks/absorb-plan.md`, research plan R-017 in `docs/research/absorb/long-list.md`), from the gap study `docs/research/absorb/18d-memory-system-baselines.md`. This file registers nothing and runs nothing. A baseline enters a result only through an arm the lead registers in `docs/research/preregistration.md`, by amendment, before its run (lead-decisions item 56). Under lead-decisions item 9 the registered hypotheses' designs are fixed before H1's data exist, so a baseline arm added later is descriptive and outside Holm.

## The rule for naming a baseline

There are two kinds of baseline, and a result says which it ran.

- **A wrapped upstream store.** The upstream product itself, behind the Adapter contract (`packages/core/src/adapter.ts`), with every model call it makes inside cached and seeded (rules 6 and 7). Mem0 and Letta are the only two, and they stay the only two: Mem0 runs in process with `infer: false`, so it makes no model call; Letta is a MemFS repository, one git commit per write (`packages/runner/src/stores.ts`; ADR 0028). Wrapping another product would take its own ADR.
- **An algorithm re-implementation.** Our own code, written from a published method, running through the injected `ModelCall` with Engram's seeds and cache. It is always labelled "algorithm re-implementation" in configs, tables, figures and the thesis, and is never called by the upstream product's name alone or claimed as the upstream product. A result says "an A-Mem-style linking policy, re-implemented", never "A-Mem". Where the upstream code is read to write it, its licence decides the mode (`docs/conventions/absorption.md`): a permissive licence allows a port with attribution in `docs/absorbed.md`; anything else allows the idea only.

An upstream system is a candidate for wrapping only if every model call it makes can be pointed at the cassette proxy (ADR 0036; card B10), so that a rerun makes no new call. A hosted API, or a server whose model base URL cannot be overridden, can only be re-implemented.

## The matrix

Licences, stars and last push read with `gh api` on 2026-11-21. "Offline" says whether the upstream system can run from cassettes as it is.

| system | upstream | licence | stars, last push | role | offline | what it could test |
|---|---|---|---|---|---|---|
| Mem0 | `github.com/mem0ai/mem0` | Apache-2.0 | 69,298, 2026-11-18 | wrapped upstream store (built) | yes, with `infer: false` | the registered store of H1 to H4 |
| Letta (MemFS) | `github.com/letta-ai/letta` | Apache-2.0 | 25,510, 2026-10-18 | wrapped upstream store (built) | the adapter yes; Letta's agent loop no | store independence, by request identity (ADR 0035) |
| A-Mem (arXiv 2502.12110) | `github.com/WujiangXu/A-mem-sys` (system), `github.com/WujiangXu/AgenticMemory` (evaluation, formerly `A-mem`) | MIT, both | 413, 2026-03-15; 1,020, 2026-10-28 | algorithm re-implementation: write-time note linking and evolution | no: model calls inside | an H2-style utility arm beside Mem0 on LongMemEval |
| MemoryOS | `github.com/BAI-LAB/MemoryOS` | Apache-2.0 | 1,627, 2026-07-07 | algorithm re-implementation: short, mid and long tiers promoted by a heat score | no: model calls inside | the same |
| Letta sleep-time compute (arXiv 2504.13171) | `github.com/letta-ai/sleep-time-compute` | MIT | 145, 2025-04-30 | algorithm re-implementation: offline rewriting of memory between sessions | no | a consolidation arm, once governed consolidation exists |
| MemOS (arXiv 2507.03724) | `github.com/MemTensor/MemOS` | Apache-2.0 | 12,470, 2026-11-20 | idea; possibly a wrapped store behind a sidecar adapter, if its model calls reach the proxy | not yet shown | breadth only, which ADR 0035 already covers by design |
| Graphiti and Zep (arXiv 2501.13956) | `github.com/getzep/graphiti` | Apache-2.0 | 32,975, 2026-11-20 | idea; it needs a graph database server and calls models inside | no | a temporal-graph comparison, after Gate D at the earliest |
| MIRIX | `github.com/Mirix-AI/MIRIX` | Apache-2.0 | 3,508, 2026-11-11 | idea only | no | none yet |
| LightMem | `github.com/zjunlp/LightMem` | MIT | 1,228, 2026-11-17 | idea only | no | none yet |
| Supermemory | `github.com/supermemoryai/supermemory` | MIT (repository) | 31,680, 2026-11-21 | a spike first: its local mode is unverified, the hosted API cannot be cached | hosted, no | none until the spike |
| FadeMem (arXiv 2601.18642), Human-Inspired Memory (arXiv 2605.08538) | no code listed | papers | | idea: decay and deduplicate-first consolidation, as governed policy (ADRs 0010 and 0025) | not applicable | a governed-decay comparison against fixed ttl |

## What a baseline arm would look like

Proposed only, for a later registration. An algorithm re-implementation runs as a store-side policy over the files or Mem0 adapter, under C2 (ungoverned, as the method was published) and under C5 (the same method behind the plane), on LongMemEval's 500 questions on M1, three seeds, with the same shared retrieval as every other condition (the Conditions section), so that only the method's write-time behaviour varies. Its metric is LongMemEval accuracy and its statistic the paired BCa bootstrap of the Statistics section; it is descriptive and outside Holm. Each method's model calls (linking, tier promotion, rewriting) are cached and seeded like any other, and counted with `COUNT=1` before registration. The fidelity of a re-implementation is a stated limit beside every number it produces.

## Sources

- `docs/research/absorb/18d-memory-system-baselines.md` (AB-GAP4-1) and its addendum in `docs/research/absorb/00-master-plan.md`, which asks the lead to confirm the labelling rule.
- The literature notes: `docs/readings/litreview/2502.12110-a-mem.md`, `2504.13171-sleep-time-compute.md`, `2507.03724-memos.md`, `2501.13956-zep.md`, `repo-graphiti.md`, `repo-supermemory.md`, `2504.19413-mem0.md`, `2310.08560-memgpt.md`, `2601.18642-fademem.md`, `2605.08538-human-inspired-memory.md`.
- ADRs 0013, 0028, 0035 and 0036; `docs/conventions/absorption.md` (ADR 0037).

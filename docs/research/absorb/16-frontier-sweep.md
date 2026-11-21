# 16 Frontier sweep, 17 October to 21 November 2026 (prefix AB-SOTA)

## Executive summary

Eleven notes were written (tier new) for work dated 8 September to 18 November 2026, including five papers from September and October that sota-2026.md does not cite (2609.08258, 2609.22818, 2610.22959, 2610.28315, 2610.30698; checked by grep). The sweep found no paper that refutes H1 to H5. It found one real positioning threat and several mechanisms Engram can adopt. The threat is HEAMS (2611.20144), a governance layer that wraps any memory system with retention and recall policies and compares systems on privacy, sovereignty and poisoning; Engram's novelty claim must now say deterministic, event-logged and replayable. SAFE-Mem (2610.22959) is the strongest concrete method: kind, authority and scope labels with admission at read, derived claims capped at their weakest input, and higher recall than no defence, which pressures H2's tax claim. Revoked but Still Authoritative (2609.08258) gives H1 a second, non-GateMem measurement (store filter 0 percent, prompt hardening 37.2 percent). Anthropic's engineering post (6 Nov) and Zep's skills paper (1 Nov) are the industry state of the art for consolidation and procedural memory, and neither governs. Search tools reached arXiv abstract pages reliably; most full texts were not read, flagged per note.

## What changed since October (for merge into sota-2026.md)

**Governance now has a rival toolkit.** HEAMS (2611.20144) evaluates memory systems as custodians of user information across performance, efficiency, privacy, user sovereignty and security, and ships a governance layer that wraps any memory system (Mem0, Letta, HippoRAG 2, in-context). Its recall governance cuts scenario leakage from 57.61 to 31.82 percent for a 4.80 point helpfulness cost (Table 5), and both recall and retention policies improve poisoning resistance (abstract). Policies are free-text and LLM-read, binary keep or drop. SAFE-Mem (2610.22959, submitted a day before the October sweep) labels claims with kind, authority and scope and cuts MPBench attack success from 26.7 to 2.6 percent while recall rises from 41.1 to 86.3 percent (Table 1). Content-judging defences (A-MemGuard, DRIFT, sanitiser, MemLineage) leave most attacks. The nearest-neighbour list is now 2606.24535, 2610.11188, 2611.20144 and 2610.22959. The sentence "first store-agnostic plane with measured tax" must become "first deterministic, event-logged, replayable plane across stores with a measured tax".

**Revocation and validity fail at retrieval, not storage.** 2609.08258 finds that Graphiti and mem0 (expiry filter off) return a revoked policy ranked above its replacement in all 81 cells; unsafe actions run at 43.1 percent undefended, 0 with a store-level filter, 37.2 with prompt hardening, 18.1 with an output filter (Table 6). 2610.30698 shows corrupting governance state changes the operative context in 96.25 percent of 2,080 matched pairs and an oracle restores 100 percent; downstream gaps are 40.54 points on LongMemEval (abstract). RegimeCouncil (2611.22113) adds that outcome feedback should be routed locally by default and pooled only on positive margin, 5.2 to 7.3 points over the better fixed policy (abstract).

**Poisoning benchmarks gained an action-level, multi-session arm.** MemoryDojo (2611.09721) puts one poisoned tool observation in session one and tracks reach across 155 trajectories and five stores: BR up to 45.70 percent, BRT up to 21.02 percent, optimised A-MEM 44.01 percent BRT; Graphiti lowest, Letta persists through core memory. No defences were tested. The Price of Safety (2609.22818, v3 on 4 Nov) shows four defences cost no detectable accuracy on benign LoCoMo with 0 to 4.5 percent token overhead, and corrects its own v1 cost (2.9 of 4.4 points were a model swap).

**Privacy for personal agents.** Disclosure Begets Disclosure (2610.28315) shows memory raises attribute leakage across sessions because agent guesses become affirmed facts; an instruction not to state or presuppose attributes brings leakage near no-memory (abstract). This is a Twin scenario and a point for the instruction arm.

**Procedural memory.** Zep Agent Skills (2611.01386) compiles versioned skills only from verified traces, gates admission, ranks by verified use and reports 4.5 to 18.8 point gains for weaker executors. SkillBuffBench (2611.22017, protocol only, no results yet) crosses skill access (none, curated, automatic) with memory on or off over four harnesses; surfaced, not noted. EvoMem (2611.25889) keeps a rejected-skill bank; surfaced, not read.

**Long context versus memory.** 2611.02361 shows reading a log degrades (48 to 55 percent at 256 events for open 32B models) while explicit state holds (96 to 98 percent), but a 120B reasoning reader trails by only about 4 points at 256 events. GrepMem (2611.25123) argues a lossless log plus regex beats lossy stores (95 to 97 percent against at most 21 percent on ContextBench, a trained 9B model).

**Industry.** Anthropic's "The components of agent memory" (6 Nov) defines memory as transcripts, notes, representations and injected context, with an offline dreaming pass (wiki-only 13 to 48 percent; wiki plus search 61 against 53), and states nothing on permissions or audit. Databricks and several vendor blogs reported similar dreaming designs; unverified, not read.

**Venues.** ICLR 2027 submissions are public on OpenReview; a Paper Digest page lists "Hidden in Memory: Sleeper Memory Poisoning" (arXiv 2605.15338, also ICML 2026) and no governance or skills papers in the part read (first 100,000 of 148,908 characters).

## Flags

| Paper | Flag |
|---|---|
| 2611.20144 HEAMS | Must cite. Threatens the novelty claim, not a hypothesis. Touches H1, H2, H4 framing. |
| 2610.22959 SAFE-Mem | Must cite. Pressure on H2 (admission with recall gain) and a baseline for H1. |
| 2609.08258 Revoked | Must cite. Supports H1 and H3; fixture for adapter conformance. |
| 2610.30698 | Cite for H3 fault-injection design. |
| 2610.28315 | Mild threat to H1 for the Twin pillar (instruction works nearly as well). |
| 2611.01386 Zep | Mild threat to H5 if the C2 arm already requires verification. |
| 2609.22818 | Mild threat to H2 knee (tax near zero where policies rarely trigger). |
| 2611.02361 | Qualifies the long-context ablation (gap closes with reader strength). |

## Landscape

| Name | URL | Licence | Activity (as verified) | Language | Gives us | Mode |
|---|---|---|---|---|---|---|
| HEAMS | github.com/milatechtransfer/heams | Apache-2.0 (gh api) | 7 stars, pushed 2026-11-20; paper 15 Nov 2026 | Python | privacy and sovereignty suites, desiderata | port or run as research harness (Python, `research/` only); never a product dependency |
| SAFE-Mem | github.com/LVenum/SAFE-Mem | Apache-2.0 (gh api) | 2 stars, pushed 2026-10-21; paper 16 Oct 2026 | Python | kind/authority/scope lattice, derived cap | ideas only (method re-implemented in core; Python, 2 stars, immature) |
| Memory-Rebirth-Attack | github.com/VulcanLab/Memory-Rebirth-Attack | Apache-2.0 (gh api) | 1 star, pushed 2026-10-27; paper 8 Sep 2026 | Python | nine-scenario revocation grid | port scenarios into TS tests (licence allows it, keep attribution) |
| MemoryDojo | none yet (forthcoming) | unknown | paper 6 Nov 2026 | n/a | BR and BRT, cross-session harness | ideas only |
| Zep Agent Skills | hosted service | commercial | paper 1 Nov 2026 | n/a | verification-strength field | ideas only |

Licences, stars and push dates above were read with `gh api repos/<owner>/<repo>` on 2026-11-21 (see Verification).

## PR plans

Only AB-SOTA-1 to 3 are concrete enough to adopt; each is a method, not a repository absorption.

**AB-SOTA-1 Revocation conformance grid for adapters.** Goal: for each adapter, write a policy, supersede it, read, and assert the revoked item is never admitted and never ranks above its replacement, under direct and indirect insertion. Absorbs: 2609.08258 scenario shape (Apache-2.0 verified, so scenarios may be ported with attribution; still author them against our plane). Files: `packages/adapters/test/plane/` (new `revocation.test.ts`; revocation is a Plane read property, not an adapter-contract case, so it is not added to the registry-driven `conformance/suite.ts`), `docs/log/`. Effort S. Depends on: none. Value: closes the stale-return failure on all three stores and gives H3 and H4 a per-store row; thesis value is a direct replication of their store-filter 0 percent result against our plane. Risks: scenario authoring bias; the plane already filters retired and superseded items on read, so the suite may pass at once (a regression guard, not a fix). Acceptance: `make test-one T=packages/adapters/test/plane/revocation.test.ts`.

**AB-SOTA-2 Authority ceiling on derived items.** Goal: a derived write (compaction, dream, distilled procedure) carries the lowest authority and kind of its inputs, enforced in core with an invariant. Absorbs: SAFE-Mem derived-from cap (2610.22959). Files: `packages/core/src/plane/write.ts` and `policy/evaluate.ts`, `packages/core/test/property/invariants.test.ts` (an eighth invariant), an ADR 0004 amendment. Effort M. Note: ADR 0004 already states that a derived item inherits the least trusted provenance of its inputs, `leastTrusted` already enforces it in promotion (`policy/promotion.ts`) and adoption (`plane/write.ts`), and the oracle already bars untrusted kinds outside person scope; the open gap is only a derived write that names its inputs, which needs a derived-from field (the schema's `lineage` lists superseded versions, not inputs). Depends on: RV4's adoption invariants merged (they are in main). Value: closes the gap sota-2026.md names; supports Anthropic-style dreaming under the plane. Risks: needs a schema field (rule 5: a separate, schema-only PR first, with `schema_version` bump, migration and `make api`); the claim that sota-2026.md names this gap is stale, ADR 0004 covers the principle. Acceptance: `make test-invariants` (new invariant).

**AB-SOTA-3 Fault-injection arm for H3 (matched clean, corrupted, enforced).** Goal: seed deletion, supersession and missing-metadata faults in the log and measure operative-projection change and recovery by replay. Absorbs: 2610.30698 design. Files: `research/configs/`, `research/scripts/` (beside `h3_fault_set.py`), `fixtures/faults/`, `docs/research/preregistration.md` amendment first. Effort M. Depends on: L2 fault set (merged, `research/configs/h3-fault-set.json`). No model call is needed for the offline control-plane arm, so rules 6 and 7 are not engaged unless a downstream reader is added. Value: turns H3's recovery claim into a number with a paired design. Risks: pre-registration amendment needed before any run (rule on preregistration). Acceptance: `make test-repro` on the new row once registered.

Not planned as PRs: HEAMS suites (licence and pin first), MemoryDojo (code unreleased), RegimeCouncil (needs outcome signal design).

## Recommended order

1. AB-SOTA-2, because it fixes a named gap and unlocks safe consolidation.
2. AB-SOTA-1, small and gives immediate per-store evidence.
3. AB-SOTA-3, after the preregistration amendment is reviewed.

## Searches run (WebSearch, extended unless noted)

1. arXiv 2611 agent memory governance
2. arXiv November 2026 memory poisoning defense LLM agents
3. arXiv 2611 agent memory benchmark long-term memory
4. arXiv 2611 agent skills procedural memory skill library verification
5. arXiv 2611 personal agents memory privacy contextual integrity disclosure
6. arXiv 2611 long context versus memory retrieval agents
7. ICLR 2027 submission agent memory OpenReview
8. Anthropic OR OpenAI OR Google DeepMind blog November 2026 agent memory
9. arXiv 2611 memory injection attack persistent memory defense provenance trust
10. "Hidden in Memory: Sleeper Memory Poisoning in LLM Agents" (standard)
11. arXiv 2611 multi-agent shared memory access control consent deletion unlearning

## Unverified

- MemoryDojo and Zep Agent Skills have no public repository to check.
- Details of Databricks MemCurrent and other vendor dreaming posts (secondary mentions only).
- NeurIPS 2026 and ACL Anthology were not searched directly; OpenAI and Google DeepMind posts not found.
- Whether SkillBuffBench, EvoMem, SPEM (2610.26995), Memorix (2611.00060), SoMem (2611.11929), DolphinBench (2609.24971), Epistemic Admission (2609.30813), Authorization Before Context (2608.17148), Top-k Retrieval Leaves Memory Value Undetermined (2611.03289) matter; surfaced by search, not read.
- Full texts of 2611.22113, 2611.01386, 2610.28315, 2611.02361, 2611.25123, 2609.22818 not read (abstracts only).
- SAFE-Mem Table 2 alignment (PDF extraction was flattened).

## Verification (2026-11-21)

Checked:
- Repositories (`gh api`): milatechtransfer/heams Apache-2.0, 7 stars, pushed 2026-11-20, Python; LVenum/SAFE-Mem Apache-2.0, 2 stars, pushed 2026-10-21, Python; VulcanLab/Memory-Rebirth-Attack Apache-2.0, 1 star, pushed 2026-10-27, Python. All absorbable by licence; all tiny and Python-only, so for a TypeScript product they are method sources or research-side harnesses.
- Papers (arXiv API): all 14 ids resolve to the claimed titles (2611.20144, 2610.22959, 2609.08258, 2610.30698, 2611.22113, 2611.09721, 2609.22818, 2610.28315, 2611.01386, 2611.02361, 2611.25123, 2611.22017, 2611.25889, 2605.15338). Headline abstract numbers for 2610.30698 (96.25 percent, 2,080 pairs, 40.54 points), 2611.02361, 2611.09721 (155 trajectories, five systems) and 2609.22818 match the abstracts. Table-level numbers (HEAMS Table 5, SAFE-Mem Table 1, Revoked Table 6) and the Zep 4.5 to 18.8 range could not be re-read here and rest on the notes. EvoMem (2611.25889) is a long-video memory paper, so its relevance to procedural memory here is weak.
- Notes: 11 notes exist, not twelve (corrected). Frontmatter ids, titles and code URLs match arXiv and the repositories; no em dash found in any of them.
- Repo fit: `packages/adapters/test/conformance/` is registry-driven and contains no revocation case; `packages/adapters/test/plane/` is where store-through-plane tests live.

Corrected: note count; licences, stars and activity filled in; AB-SOTA-1 moved to `test/plane/`; AB-SOTA-2 scope narrowed (ADR 0004 and `leastTrusted` already cover the principle, schema field needed first); AB-SOTA-3 gains the preregistration amendment file.

Refuted: "sota-2026.md has not written down derived-item trust inheritance" (the ADR 0004 amendment does). No other claim refuted.

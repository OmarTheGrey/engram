---
date: 2026-11-19
author: claude-agent
type: finding
card: L2
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-fault-set.json
  - fixtures/fault-sets/longmemeval/README.md
supersedes: none
---

**What.** What H3's seeded-fault set can and cannot tell the thesis, as the result's `limits` field states it.

**Why.** Review finding L2-1: nothing said that the set confirms the deterministic lints by construction.

**Result.** It can tell: a regression check on L1's lints; model-tier accuracy on clean, pre-paired template cases, as an upper bound; and the gaps, wrong-scope (500 faults, no lint) and the deterministic tier on unkeyed faults. It cannot tell how common these faults are, real-world recall, or precision on natural memory without the audit sample. Per-class figures pooled over keyed and unkeyed faults depend on the mix (stale and unsupported 2 keyed to 1, misplaced 1 to 1, contradictory 0 to 1). Every hardened near-miss gets the deterministic outcome its label says: 0 near-misses flagged, 0 unexpected findings on injected items (`label_check`).

**Consequence.** L4 and the thesis report these figures with that scope.

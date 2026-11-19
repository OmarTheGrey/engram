---
date: 2026-11-19
author: claude-agent
type: finding
card: L4
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-floor.json
  - research/results/h3-fault-set.json
supersedes: none
---

**What.** Which floor numbers hold by construction, as the result's `by_construction` states beside L2's `limits`.

**Why.** L2's review (finding L2-1) showed the keyed subtypes restate their lints' triggers.

**Result.** By construction: keyed recall 1.0 and keyed labelled precision 1.0 (L2's label check fails the set otherwise), unkeyed recall 0 (no deterministic lint reads text), and wrong-scope recall 0 under both tiers (no lint is built for it). Measured: the 967 base-item findings and the precision bound they give, 0.721 to 1.0, open until members judge L2's audit sample.

**Consequence.** Until the lead decides the backlog row on H3's deterministic claim, the floor is a regression check on L1, not evidence for H3's precision claim.

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
supersedes: docs/log/2026-11-19-l4-finding-by-construction.md
---

**What.** Which floor numbers hold by construction, as the result's `by_construction` states beside L2's `limits`.

**Why.** L2's review (finding L2-1) showed the keyed subtypes restate their lints' triggers; this card's review (L4-1, L4-3, L4-6) corrected the rest.

**Result.** By construction: keyed recall and precision of 1.0, overall and per keyed lint; unkeyed recall 0, as no deterministic lint is built for what makes an unkeyed item faulty, which is in its text only; wrong-scope recall 0 under either tier, as its labels name no lint. Measured: the 967 base-item findings, whose precision is bounded only by 0 and 1; the pooled 0.721 to 1.0 moves with the injection rate and is not precision on natural memory.

**Consequence.** The floor is a regression check on L1 until the lead decides H3's deterministic claim.

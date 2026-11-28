---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/residue/check.ts
  - research/scripts/h3_erasure_residue.py
  - research/configs/h3-erasure-residue.json
supersedes: docs/log/2026-11-28-x19-decision-byte-attribution.md
---

**What.** In a byte tier, a hit of a canary the plane keeps by decision (promoted, or at a shared ref) is `indeterminate`, never retained. So is a hash the log keeps by decision and holds as nothing else. Byte-tier rates are over the countable canaries (160 of 200 here), with the share of all 200 beside them.

**Why.** The review found the earlier rule labelled those bytes retained, overstating what the plane keeps: a kept copy and the erased version hold identical bytes, so they cannot be told apart. A rate over 200 also understated the share of the canaries that can be counted.

**Result.** Bytes are never counted as retained.

**Consequence.** The register and the page give both counts.

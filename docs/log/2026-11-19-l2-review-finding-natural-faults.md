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
  - packages/bench/scripts/fault-set-check.ts
supersedes: docs/log/2026-11-19-l2-finding-natural-faults.md
---

**What.** LongMemEval's own turns carry faults nobody seeded, now measured rather than left out.

**Why.** The superseded entry counted 968 duplicate findings on base turns; review finding L2-2 showed one of them was on a labelled near-miss, and L2-1 asked that natural findings be counted.

**Result.** On the full set (`research/results/h3-fault-set.json`): the duplicate lint flags 967 base turns (`label_check.unlabelled_findings_on_base_items`), 50 of them drawn for the audit (`audit`); with the near-miss fixed, 0 findings fall on injected items unexpected. As B5 writes them, 124,334 of 246,750 turns would be missing-provenance findings (`base.missing_provenance_as_b5_writes_it`); the set names the assistant model, so they are recorded, not shown. Content-level faults in upstream text cannot be counted without a model.

**Consequence.** L4 reports model-tier precision on injected items and on base items apart.

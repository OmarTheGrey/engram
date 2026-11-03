---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/analysis/h1.py
  - packages/runner/src/research/h1-sessions.ts
supersedes: docs/log/2026-11-03-pr4b-lp-decision-utility-checkpoints.md
---

**What.** Recommended, for the lead's decision, unchanged from the superseded entry: H1's GateMem run keeps the 728 utility checkpoints, and MGS's U is upstream's effective utility, judged complete with the right action, the same in both tables (decision sheet item 20).

**Why.** The superseded entry said accepting changes `gatememUtility` and its tests before the tag. The code now computes this U (`2026-11-03-pr4-polish-effective-utility`), so that sentence no longer holds.

**Result.** Accepting needs no code change; the alternative, U as `utility_ok` alone, now needs one, in `_part_outcome` of `research/analysis/h1.py` and its tests. Against the primary table, `summary.json`'s `compliance_utility_score` now differs only in pooling sessions where the table averages items.

**Consequence.** The lead's answer on item 20 supersedes this entry.

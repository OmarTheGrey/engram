---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.15
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/results/h1-gate-mutation-audit.json
  - make results-register
supersedes: none
---

**What.** After merging main (through #157), `make results-register` failed: "research/results/h1-gate-mutation-audit.json: sha256 does not match MANIFEST.md".

**Why.** The merge left the branch's older copy of that result file (sha256 8e61f235...) beside main's MANIFEST row (6afe298f...); this card never changed it.

**Result.** The file was taken from main (`git checkout origin/main -- research/results/h1-gate-mutation-audit.json`); its sha256 matches the row, the register and page rebuild, and the only result files differing from main are this card's MANIFEST row and `h1-audit-report.json`.

**Consequence.** None for the card; the orchestrator may want to check the register helper's handling of result files.

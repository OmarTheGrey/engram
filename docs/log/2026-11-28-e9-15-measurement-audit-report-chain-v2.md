---
date: 2026-11-28
author: claude-agent
type: measurement
card: E9.15
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-audit-report.json
  - research/results/MANIFEST.md
  - research/configs/audit-report.json
  - uv run python research/scripts/audit_report.py --config research/configs/audit-report.json --out research/results/h1-audit-report.json
supersedes: docs/log/2026-11-28-e9-15-measurement-audit-report.md
---

**What.** The audit report's proof of concept regenerated after merging main (card E1.9's chain version 2) and the review's changes, on one chained SQLite fixture log with a fixed key and no model, never a hypothesis result (MANIFEST row, commit 87bef631, sha256 d5038406...0c5e, the same on two runs).

**Why.** Chain version 2 changes every chain hash, and the report now declares the fixture's reader to the oracle.

**Result.** 11 cases, 11 as expected; 8 of 8 tamperings detected; 5 events counted; the oracle, with 1 actor declared (set sha256 82368d87...cc1b), counts 0 violations; the envelope is 3,351 bytes, sha256 c53d136b...ae0e.

**Consequence.** Rewrite the MANIFEST commit to the squash commit after merge.

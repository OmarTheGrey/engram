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
supersedes: none
---

**What.** The signed audit report on a fixture log, a proof of concept on one chained SQLite log with a fixed key and no model, never a hypothesis result (MANIFEST row, commit 47f8dc31, sha256 dc1562bf...7f31f, the same on two runs).

**Why.** The card's acceptance, as a reproducible result.

**Result.** 11 cases, 11 with the expected verdict and failed check; 8 of 8 tamperings detected (2 at the signature, 2 at the chain, 2 at the head, 2 at the counts); the report as exported and after a later write OK; no key pinned UNSIGNED. 5 events counted in the window; the envelope is 2,979 bytes, sha256 c3f2a52a...6b18, fixed by the log, the clock and the key.

**Consequence.** The register section reads the file. Rewrite the MANIFEST commit to the squash commit after merge.

---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
  - research/analysis/h1.py
supersedes: docs/log/2026-11-03-pr4a-r1-decision-violation.md
---

**What.** GateMem and MEM-INV-Bench violations are unchanged from the superseded entry. GateMem's utility checkpoints are now kept as sessions of kind `utility`, with `utility_ok`, for MGS only. Every session records `gate_by_action`. A wrong action counts only in the gate-by-action table, from `make h1-table GATE_BY_ACTION=1`.

**Why.** The superseded entry said utility checkpoints are left out (D1). Gate-by-action now has its own files (D2).

**Result.** Benign MEM-INV-Bench cases and C1 are still left out, and utility sessions enter no rate or test.

**Consequence.** v1's metric line is unchanged; MGS and the second table are secondary.

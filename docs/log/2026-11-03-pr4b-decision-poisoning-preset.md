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
  - research/results/h1-mem-inv-admission.json
  - docs/log/2026-11-03-pr4a-finding-mem-inv-admission.md
supersedes: none
---

**What.** Recommended, for the lead's decision: C5 enforces medium on MEM-INV-Bench, H1's preset on both arms (decision sheet item 11).

**Why.** Strict's protection on this arm comes from withholding all shared memory, benign values included.

**Result.** Medium admits 32 of 32 attacks and 6 of 6 benign values; strict admits 8 of 32 attacks, all summarize, and 0 of 6 benign values, all 78 `team:operations` entries waiting for review (`research/results/h1-mem-inv-admission.json`).

**Consequence.** Under medium this arm's C4 minus C5 compares the model reading provenance with the plane's tagged read; v1 says so.

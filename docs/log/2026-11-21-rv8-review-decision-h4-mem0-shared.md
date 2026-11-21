---
date: 2026-11-21
author: claude-agent
type: decision
card: RV8
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/results/h2-cost-table.json
  - research/configs/cost-table.json
  - research/tests/test_cost_table.py
supersedes: none
---

**What.** H4's `h4-gatemem` arms C5 and C2 on Mem0 and M1, with their judge rows, carry `shared_with: h1-gatemem` per arm, so they enter no total.

**Why.** An arm may now state `shared_with` and `count` of its own; the run-level value is the default.

**Result.** H4's other arms (files, Letta, M2, M3, C7) stay new: another store or model changes the cell key, and C7 reads unfiltered. Tests: the shared ids and their judges, every other arm unshared, totals unchanged by removing the shared rows.

**Consequence.** If card X9 draws a rule that does not subset H1's items, these arms become new again.

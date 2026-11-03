---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - packages/runner/src/research/h1-sessions.ts
  - research/tests/test_h1_secondary.py
  - research/tests/test_h1_pipeline.py
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: none
---

**What.** MGS's U is upstream's effective utility in both H1 tables: utility sessions carry `utility_ok` and `action_ok`, and the table counts a session in U when both hold. v1, items 14 and 20 and section 7 now say the pipeline computes it.

**Why.** Part B's last polish recommends this U (item 20); the code applied the action only under gate-by-action, so accepting would have meant a change before the tag.

**Result.** Unit test: C4's U falls from 0.75 to 0.5, since u3 is complete with the wrong action, and MGS to 0.5 x 0.75 x 0.5. Planted CLI run: C5's U is 0.5 in both tables, so the main table's MGS goes from 1 to 0.5 and the gate-by-action table's stays 0.25. Two mutants are killed: U as `utility_ok` alone, and the converter recording every action as right.

**Consequence.** No result's code changed.

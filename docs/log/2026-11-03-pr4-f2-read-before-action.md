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
  - research/tests/test_h1_secondary.py
  - research/tests/test_h1_pipeline.py
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: none
---

**What.** Each MEM-INV-Bench session records `read_before_action`, from a non-empty `read`. Each MEM-INV-Bench rate gives `read_before_action`: `count`, `sessions`, `share`.

**Why.** Shared design D3 (V-2, ADR 0029).

**Result.** Unit test: 3 of 4 C4 sessions, an excluded one included, and 0 of 4 at C5. Planted CLI run: 2 of 7 C4 sessions. The mutant reading an empty `read` as a read is killed.

**Consequence.** Part B names the count in v1's read-before-acting promise.

---
date: 2026-11-19
author: claude-agent
type: change
card: L2
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/generate.ts
  - packages/bench/scripts/fault-set-check.ts
  - research/scripts/h3_fault_set.py
  - packages/bench/test/faults/generate.test.ts
  - research/tests/test_h3_fault_set.py
supersedes: none
---

**What.** The review fix pass of PR #46, after rebasing onto main at `02bd0f1` (card L3 merged).

**Why.** Review findings L2-1 (critical) to L2-5.

**Result.** Boundary near-misses (validity ending at the lint time plus one millisecond), cue-free restatement pools, four unsupported-claim variants, and a `variant` field on labels. The check counts base-item findings instead of failing on them, fails on any unexpected finding on an injected item, plans L3's units with core's `planModelLints` (the copy is deleted) and counts them under medium. The script draws a seeded audit sample and writes `limits`. No turn is quoted twice. Six new TypeScript tests and three Python tests, each new key test mutation-checked.

**Consequence.** The fixture set and the full result are re-recorded; L4 scores against `finding_on` and reads the audit sheet.

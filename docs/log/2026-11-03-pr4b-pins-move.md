---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/bench/PINS.md
  - packages/cli/test/doctor.test.ts
  - packages/bench/test/mem-inv-bench/load.test.ts
  - "make engram ARGS=doctor"
supersedes: none
---

**What.** MEM-INV-Bench moved into the pinned table of `packages/bench/PINS.md` at `cf3c9a4`, with its data revision, licence, judge and plug-in point, and MPBench moved to the candidates table.

**Why.** Plan decision 8 and ADR 0029: v1 registers MEM-INV-Bench for H1, and MPBench has no release and no pin. No result existed, so rule 8 does not bite.

**Result.** Before: six rows, five pinned, MEM-INV-Bench a candidate. After, `engram doctor` prints "6 benchmarks, 6 pinned; ... mem-inv-bench 1355 lines at cf3c9a4". What parses the file: `research/tests/test_prereg.py` (10 passed); doctor's `parsePins` and `parseCandidates` and their tests (14 pin tests passed; the candidate path now runs on a copy with the row moved back, written first and seen failing on the old file); the bench's load test (6 passed). A bench comment, a test title and the fixture README no longer call it a candidate.

**Consequence.** `make test-e2e` runs doctor on the moved table.

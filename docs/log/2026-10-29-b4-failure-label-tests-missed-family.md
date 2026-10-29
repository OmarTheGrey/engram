---
date: 2026-10-29
author: claude-agent
type: failure
card: B4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/mem-inv-probe.test.ts
  - packages/bench/test/mem-inv-bench/plane.test.ts
  - packages/bench/scripts/vendor-mem-inv-bench.py
supersedes: none
---

**What.** B4's hidden-label tests could not catch a leak of `family` or of the case id, and the case ids encoded family and channel in blocks.

**Why.** The relabelling test kept `family` fixed (it must agree with the channel), ids were assigned in picking order, and the id was copied into every provenance ref.

**Result.** Review R6-4 fed `family` into the prompt and every runner test passed. Now a test runs an attack and a benign case with the same task and memory and compares every request, a canary id must appear in no request or decision, refs name the entry only, and ids follow a seeded shuffle. Mutation: `family` in the prompt fails the twin test; the case id in the prompt fails the canary test.

**Consequence.** A stripping test varies every hidden field, including the ones the schema ties together.

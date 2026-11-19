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
  - packages/bench/src/faults/labels.ts
  - packages/bench/src/faults/bank.ts
  - packages/bench/test/faults/generate.test.ts
  - "pnpm --filter @engram/bench exec vitest run test/faults"
supersedes: none
---

**What.** Card L2's seeded-fault generator: LongMemEval memory states built as B5 builds them, with labelled faults of four classes in nine subtypes, each beside an unfaulted near-miss of the same shape, all written through the Plane on the fake store.

**Why.** H3 measures lint precision and recall on this set; precision needs near-misses, and L4 needs to know which lint of each tier should find each fault.

**Result.** A label names class, subtype, keyed or not, the lints of each tier expected to flag it, the lints a near-miss must not trigger, and related items. Thirteen tests pass, among them: no label word reaches any event; a fault and its near-miss differ only in the subtype's key; Plane.lint flags every keyed fault and nothing else it measures. Mutation checks: dropping the assistant model, or really editing a near-miss source, fails a test.

**Consequence.** L4 scores both tiers on these labels.

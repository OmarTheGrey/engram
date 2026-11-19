---
date: 2026-11-19
author: claude-agent
type: decision
card: L2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/bench/src/faults/generate.ts
  - packages/core/src/lint/det.ts
  - packages/bench/test/faults/generate.test.ts
supersedes: none
---

**What.** An expired-validity fault's validity ends exactly at the lint time and its near-miss's one millisecond later, by `valid_to` or by `ttl` (the seed picks one per pair, recorded as the label's `variant`); the orphan near-miss's source likewise stays valid until one millisecond after the lint time.

**Why.** Review finding L2-1: thirty days past the lint time tested nothing. L1 treats a validity ending at the lint time as ended (`valid_to` not after it; past ttl at it), so the fault sits on the boundary and the near-miss just past it. A ttl is whole seconds, so `valid_from` is set back so that it plus the ttl lands on the boundary.

**Result.** A test checks both variants end at 0 and 1 millisecond from the lint time, and fails when the near-miss is moved to 30 milliseconds.

**Consequence.** A lint that used `<` for `<=` fails the label check.

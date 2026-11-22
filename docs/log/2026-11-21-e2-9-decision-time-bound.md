---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.9
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/backtracking.ts
  - packages/core/scripts/gitleaks-rules.ts
supersedes: none
---

**What.** The time bound of ADR 0039 decision 6 is enforced when a rule is admitted, not while it runs: every rule is timed on adversarial inputs (200 ms per input at 16,384 characters in the generator, 8,192 in the unit test), and content over 1,048,576 characters is held unscanned (`engram/write/guard-failure`).

**Why.** Core reads no clock, and a decision that depends on how fast the machine was is not replayable. A linear rule's work is then bounded by the scan limit.

**Result.** The slowest admitted gitleaks rule took 58 ms at 16,384 characters under load; the fastest left out, over 400 ms at 8,192. A rule that throws holds the write naming only the rule.

**Consequence.** If a rule is linear but slow on input it was not timed on, a large write is slow, not wrong.

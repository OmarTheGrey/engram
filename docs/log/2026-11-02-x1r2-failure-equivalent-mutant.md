---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/mem-inv-probe.ts
supersedes: none
---

**What.** A mutation check that removed the note's whitespace check passed the tests.

**Why.** The reply is stripped twice (when recorded and when used), so removing either strip alone changes nothing: an equivalent mutant.

**Result.** Removing both strips fails two tests; the double strip stays, since a recorded cassette may predate the first.

**Consequence.** Found while working the round-2 fix pass.

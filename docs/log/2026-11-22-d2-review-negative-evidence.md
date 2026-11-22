---
date: 2026-11-22
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/induce.ts
  - packages/core/test/unit/distill/induce.test.ts
supersedes: docs/log/2026-11-21-d2-decision-negative-evidence.md
---

**What.** Negative evidence is still each example's abandoned branches and withdrawn attempts. The positive trajectory now keeps a call only when its result says it succeeded (`is_error` false). A call with no result on the branch no longer counts as a success (finding D2-8).

**Why.** The superseded entry said AWM's `remove_invalid_steps` drops actions that did not run. It actually drops malformed `click` and `fill` calls, plus `scroll` and `noop` in the prompt induction. Tool calls have no such syntax, so success is the analogue.

**Result.** Every fixture call has its result, so the fixture prompt is unchanged: the cassette re-recorded byte for byte.

**Consequence.** None.

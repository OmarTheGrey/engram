---
date: 2026-11-28
author: claude-agent
type: change
card: D5
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/plane/promote.ts
  - packages/core/src/plane.ts
  - packages/core/test/unit/lint/procedural.test.ts
supersedes: none
---

**What.** `Plane.promote` passes the promotion gate's decision through `applySafetyScan`; `PromoteOptions.release` carries a release reason.

**Why.** Card D5, steps 2 and 3: with `procedures.safety_scan: hold`, a critical finding holds the candidate so replay cannot admit it, released only by a user-sourced actor with a reason (rule 3: every decision an event with a reason and a policy id).

**Result.** Off or absent: nothing changes (tested). Report: findings appended to the reason, no decision changes. Hold: an allowed promotion with a critical finding is one `gate` event, decision `ask`, under `engram/promote/safety-scan`, the item a candidate; presented again with `release` by an actor ADRs 0026 and 0049 allow, it lands and the reason records the release. A malformed release is an InvalidCallError before the log; a release by another source is a deny event, defence in depth only.

**Consequence.** No registered preset or config sets the option.

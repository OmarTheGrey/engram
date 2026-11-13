---
date: 2026-11-07
author: claude-agent
type: decision
card: B5
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/longmemeval/plane.ts
  - packages/bench/src/longmemeval/strip.ts
  - packages/runner/src/longmemeval-probe.ts
supersedes: none
---

**What.** LongMemEval's mapping onto the plane: one user, `person:user`; every history turn is an episodic item in that scope, a user turn with source `user` and an assistant turn with source `model`; only C2 and C5 are built.

**Why.** The benchmark has one user and their assistant; source isolation keeps model content in the person scope (ADR 0004, 0007). Item refs name a session and turn by position, since upstream's session ids (`answer_...`) mark evidence and `_abs` marks abstention; `strip.ts` drops these, the answer and `has_answer` before anything is written or prompted. Card B5 asks for the ungoverned baseline (C2), card B6 for the enforced one (C5).

**Result.** `plane.test.ts` checks that no item carries a label; the runner config refuses other conditions.

**Consequence.** Under `medium` every turn is admitted, so C5 differs from C2 here by retention and read filtering only.

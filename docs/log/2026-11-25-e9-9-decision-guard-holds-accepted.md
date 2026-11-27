---
date: 2026-11-25
author: claude-agent
type: decision
card: E9.9
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/owner-accepts.test.ts
  - docs/decisions/0039-content-guards-at-the-write-gate.md
supersedes: none
---

**What.** The content guards' `review` holds are accepted the same way as the injection screen's, the reason naming the guard's rule id.

**Why.** The instruction named only the screen; a guard hold is the same candidate status, and ADR 0039 says a person promotes it. Excluding it would need a second rule.

**Result.** A personal-data hold on the owner's own write is accepted with `the content guard held it (engram/write/pii)` in the reason. Cost if wrong: a person can release a guard hold on their own content alone.

**Consequence.** None; the guards are off in every registered preset.

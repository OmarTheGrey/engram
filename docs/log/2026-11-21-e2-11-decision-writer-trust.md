---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/trust.ts
supersedes: none
---

**What.** Protection judges a write at the kind the plane records for it, and a sweep at its sweeper's source, the least trusted kind when it sets none.

**Why.** The card says "the writer"; the recorded kind is what the plane attests (the source, the floor, or adoption's kind), and a sweep carries no item.

**Result.** With the floor off, a sourceless write is judged at its claim, so `medium-trust` turns both options on together.

**Consequence.** If wrong, a sourceless caller under `protect_trusted` alone is believed; the preset does not run that way.

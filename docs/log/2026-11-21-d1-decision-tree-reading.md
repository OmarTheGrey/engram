---
date: 2026-11-21
author: claude-agent
type: decision
card: D1
chapter: design
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/episode.ts
  - packages/runner/test/session-fixtures.test.ts
supersedes: none
---

**What.** The parser reads a session the way pi's `SessionManager` loads it. The final leaf is the last entry in the file. A malformed line is skipped and counted. Other choices are its own: thinking blocks are dropped, an image is written as `[image]`, a branch of bookkeeping entries alone is dropped, a version below 3 is refused, and a duplicate entry id is refused.

**Why.** The episode must agree with what pi shows as the session. Thinking can be large and is not needed for AWM-style induction (ADR 0012).

**Result.** On all fifty fixtures, pi's `getBranch()` and `getTree()` leaves match the parser's.

**Consequence.** Card D2 sees no model reasoning text. If D2 needs it, the parser keeps thinking blocks behind a new field.

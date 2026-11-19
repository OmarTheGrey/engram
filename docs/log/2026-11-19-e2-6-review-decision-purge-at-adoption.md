---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - docs/decisions/0007-write-gate-and-source-isolation.md
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** Adoption deletes, after committing its refusal, a record under an erased id and a record in an offboarded person scope under an id the log never allowed (`engram/adopt/offboarded`); a transient failure is a store-failure deny and is retried, a permanent refusal is left refused.

**Why.** A crashed writer's bytes have no writer left to remove them; adoption is the next plane call that sees them, and `engram read` runs it before every read.

**Result.** RV3 to RV5 pass; a writer whose bytes land in the window and commit later finds the refusal and is refused itself, so nothing is lost silently.

**Consequence.** A Claude Code memory file written into an offboarded person scope stays refused.

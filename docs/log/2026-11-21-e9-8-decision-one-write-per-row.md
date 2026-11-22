---
date: 2026-11-21
author: claude-agent
type: decision
card: E9.8
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/run.ts
  - packages/server/src/app.ts
supersedes: none
---

**What.** `engram import` makes one write call per row through the existing write route, instead of one call to a new import route.

**Why.** ADR 0027 decision 3 asks one call per command; the card asks each row to be a Plane.write, and the server caps a request body at 1 MiB (MAX_BODY_BYTES).

**Result.** Each row is exactly one gated write with its own event, no request carries more than one row, and no route holds import logic. The help text and run.ts say import is the exception. The cost: an import is not atomic; a crash leaves the rows written so far, each a candidate.

**Consequence.** None.

---
date: 2026-11-21
author: claude-orchestrator
type: failure
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/E8.12.md
  - docs/tasks/E2.10.md
  - docs/tasks/L5.md
  - docs/tasks/D1.md
  - docs/tasks/E9.8.md
  - packages/core/src/lint.ts
supersedes: none
---

**What.** Seven smaller card errors were found by the review of PR #69 and corrected (findings AP-7 to AP-9).

**Why.** Each was a detail written without opening the file it concerned.

**Result.** E8.12's invariant had nowhere to record authentication (now a side table). E2.10's lint id was not kebab-case and its id list file was missing. L5 doubted a threshold key that exists in `packages/core/src/lint.ts`. D1 asked for fifty fixtures with no generator and would have moved `distill.ts`. E9.8's round trip ignored that import mints ids. ADR 0041 miscounted core's dependencies. The plan's dependency column disagreed with the roadmap's.

**Consequence.** All corrected in the cards' generator and regenerated.

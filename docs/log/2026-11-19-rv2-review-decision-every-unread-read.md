---
date: 2026-11-19
author: claude-agent
type: decision
card: RV2
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/research/h1-sessions.ts
  - packages/runner/test/research/h1-sessions.test.ts
supersedes: docs/log/2026-11-19-rv2-decision-every-unread-read.md
---

**What.** `memInvSessions` refuses readings that leave an UNREAD attack session of the run unread, through the blind join or a file keyed by session (`h1-readings/1`). With no readings, UNREAD sessions stay excluded.

**Why.** Item 14 refuses a missing verdict, and a partial `h1-readings/1` file left the hole the blind join had. This is stricter than upstream. MEM-INV-Bench's `code/score.py` at the pin scores with UNREAD rows left out and never refuses a partial reading. H1 departs from it here, so a session cannot leave the denominator by being silently skipped. Scored readings are counted as upstream counts them.

**Result.** Vitest checks the refusal, and the check's mutant fails it.

**Consequence.** If wrong, a partial adjudication must be completed first. The thesis must name this departure beside upstream's scoring.

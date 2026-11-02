---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/count.test.ts
supersedes: none
---

**What.** Before commit d7620e7, a live run of an experiment checked and fetched its data before the live guards ran, so a run refused under ENGRAM_OFFLINE=1 could still download GateMem's files.

**Why.** The data check was placed before the guards.

**Result.** Commit d7620e7 moved it after them; a regression test now runs such a refused run on an empty data folder and checks that nothing is fetched or created. Moving the check back fetches the four domains and fails it.

**Consequence.** The independent review of PR #25 asked for this entry and the regression test; the fix itself was commit d7620e7.

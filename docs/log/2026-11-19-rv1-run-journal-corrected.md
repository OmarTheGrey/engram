---
date: 2026-11-19
author: claude-agent
type: change
card: RV1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/journal.ts
  - packages/runner/test/rv1-review.test.ts
supersedes: docs/log/2026-11-19-rv1-run-journal.md
---

**What.** The run journal's `run.json` fingerprint now names the config's data folder and scripts, a script by its contents too; the earlier entry said it left out every path.

**Why.** Review RV1-7: without them, a resume after a script edit mixed the rows of two scripts.

**Result.** Only the cassette folder and `spend_ceiling_usd` are outside the fingerprint, so a live run and its replay still share a folder and a raised ceiling still resumes. The crash and resume test of `packages/runner/test/rv1.test.ts` passes unchanged.

**Consequence.** None beyond the refusal.

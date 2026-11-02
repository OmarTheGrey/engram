---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/run-mem-inv.ts
supersedes: none
---

**What.** A live run of an experiment config ended with "a pipeline config's numbers are still not results".

**Why.** The footer distinguished live from scripted runs but not experiments from pipelines.

**Result.** `runFooter` words it by the config's kind for both arms.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.

---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/scripts/run-mem-inv.ts
supersedes: none
---

**What.** `runMemInvMain` in `run-mem-inv.ts` had no caller and no experiment guard, so it could replay or record an experiment config.

**Why.** It was kept for compatibility when run.ts took over.

**Result.** It is removed; run.ts is the one entry point.

**Consequence.** Found by the independent review of PR #25 and fixed in its review fix pass.

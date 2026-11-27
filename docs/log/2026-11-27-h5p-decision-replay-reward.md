---
date: 2026-11-27
author: claude-agent
type: decision
card: H5P
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/H5P.md
supersedes: none
---

**What.** Proposed for the lead: scoring the replay by tau2's own reward, `tau2_reward`, the same number as H5's metric.

**Why.** Today `tau2Reward` in `packages/runner/src/replay-validate.ts` reads the database check alone (`docs/log/2026-11-22-d3-finding-tau2-reward-db-only.md`), so a task with no database part always fails the replay.

**Result.** The harness card changes the oracle; no code changes in this card. Card H5P row 7.

**Consequence.** The lead's answer entry on this item supersedes this one; nothing is registered until then.

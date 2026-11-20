---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/rv6.test.ts
  - AGENTS.md
supersedes: none
---

**What.** AGENTS.md, the plan and the log said a merged run is byte for byte the unsharded one, but its usage files differ after a crash in the middle of a session (review P60-5).

**Why.** The resume replays the calls that session had recorded, and the ledger counts them as hits (`cached: 1`); only crashes between sessions were tested.

**Result.** A test crashes a shard on its fourth call (the second session's second), resumes it with one new call and one hit, and merges: results, events and summary are the unsharded run's, the paid ledger lines are the same, and `usage.json` differs only by `cached: 1`. AGENTS.md, CLAUDE.md, the plan, the Makefile help and `shard.ts` now say so.

**Consequence.** The claim is stated as tested.

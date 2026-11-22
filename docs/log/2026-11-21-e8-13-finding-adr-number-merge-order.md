---
date: 2026-11-21
author: claude-agent
type: finding
card: E8.13
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/tasks-and-decisions.test.ts
  - "pnpm exec vitest run --project scripts"
supersedes: none
---

**What.** On this branch alone, `pnpm exec vitest run --project scripts` fails one test, `the index lists ADRs 0001 to 0023 and every later one, consecutively`, because ADR 0043 follows 0041: 0042 is card E8.12's, on its branch and not yet on main.

**Why.** The orchestrator assigned 0043 since E8.12 drafts 0042 in parallel.

**Result.** A trial merge of branch e8-12-verified-actors into this one (`git merge --no-commit`, then `git merge --abort`; HEAD unchanged at 74ab41e) had conflicts only in `docs/decisions/README.md`, `docs/tasks/lead-decisions.md` and `scripts/test/tasks-and-decisions.test.ts`, each resolved by keeping both sides (OWNER_DECIDES 0034, 0042, 0043; items 60 and 61 under one section F). The scripts project then passed, 191 of 191.

**Consequence.** Merge E8.12 before E8.13. If E8.13 must go first, renumber its ADR to 0042 and item 61 to 60.

---
date: 2026-11-25
author: claude-agent
type: change
card: ANS-2026-11-25
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/tasks-and-decisions.test.ts
  - docs/README.md
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - docs/tasks/lead-decisions.md
  - make test-one T=scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** The review fix pass of card ANS-2026-11-25 (findings ANS2-1 to ANS2-7).

**Why.** The review approved after fixes: two important findings and five minor ones.

**Result.** The owner-promotion finding is superseded by a corrected one. `docs/README.md` no longer calls ADR 0034 proposed. The tasks-and-decisions test now checks each ADR file's own `Status:` line against the index, and requires a decision entry dated on or after the acceptance; 243 of 243 pass. Removing the eight acceptance entries fails 8, and reverting ADR 0043's `Status:` line fails 1. ADR 0034 records that the acceptance lifted its 2026-11-21 condition and how card E2.21 lands. Decision 3 now defines the cap. `lead-decisions.md` credits the lead only with "accept the adrs", and the TUI calls now stand under the delegation.

**Consequence.** An acceptance PR without its decision entries now fails the test.

---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - scripts/test/tasks-and-decisions.test.ts
  - docs/decisions/README.md
  - "make test"
supersedes: none
---

**What.** The first full `make test` of this PR failed one of 2,409 tests: step-0 task S0.13's check that every ADR in the index is decided rejected ADR 0031's `proposed` row.

**Why.** The plan's brief drafts new ADRs as `proposed` for the lead, and the index lists them (its own rule: "Status is one of proposed, accepted, superseded"); the test admits an undecided ADR only through its `OWNER_DECIDES` set, which was empty. Earlier plans had written "accepted, pending lead review" instead.

**Result.** ADR 0031 is in `OWNER_DECIDES`, the set the test keeps for ADRs left to the owner (decision entry `2026-11-02-x1-adr-0031-left-to-the-lead.md`); the rest of the test is unchanged and passes.

**Consequence.** When the lead accepts ADR 0031, the row's status changes and 0031 leaves the set.

---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - scripts/test/tasks-and-decisions.test.ts
  - "make test"
supersedes: none
---

**What.** The first full `make test` on the branch failed two tests of 2851: the invariants file's Plane surface check ("a new Plane method must be classified here") and the decisions check that every ADR outside the owner's list is decided (ADR 0034 is proposed).

**Why.** Both are registration points a new Plane method and a new proposed ADR must be entered in; the card's own tests ran by file and did not reach them.

**Result.** `changeGrants` is classified in the surface check (its own decision entry, `2026-11-19-e9-4-invariants-classify-change-grants.md`), and ADR 0034 joins `OWNER_DECIDES`, as ADRs 0031 to 0033 did. Both files pass.

**Consequence.** None beyond the lead's second review of the invariants file.

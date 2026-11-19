---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** Verification finding V-7 of PR #44: the walk's grant-provenance check could not detect a resurrected grant.

**Why.** It accepted a grant on a returned item if any allowed write had ever carried it, so a grant removed and then brought back by a fault would pass.

**Result.** Fixed by decision `2026-11-19-e9-4-verification-decision-latest-event.md`; a projection mutant that keeps removed grants on an update now fails invariant 5 with "returned with grants its latest event does not carry", where the old check passed it.

**Consequence.** None.

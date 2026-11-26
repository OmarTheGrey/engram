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
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - docs/log/2026-11-25-ans-2026-11-25-decision-adr-0034-expiry-cap.md
  - make test-one T=scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** The fixes for verification findings ANS2-8 and ANS2-9 of card ANS-2026-11-25.

**Why.** Any decision entry citing the index on an ADR's acceptance date counted as its acceptance, and ADR 0034's decision 6 re-judged kept grants, which nobody decided.

**Result.** ANS2-8: the test names its one bulk acceptance (`BULK_ACCEPTANCES`, `docs/log/2026-11-02-adrs-accepted.md`); any other entry must cite the ADR's file and name its number in its body. Removing that entry fails 6 tests; removing the 0038 to 0041 acceptance fails 4 (0038 and 0041). ADRs 0039 and 0040 still pass through later card decisions that cite and name them. 271 of 271 pass. ANS2-9: decisions 3 and 6 and the cap's decision entry say the cap and the expiry check reach every grant of a first write and every grant a grant change adds, on both paths alike; kept grants are not judged again.

**Consequence.** Card E2.21 builds the corrected rule.

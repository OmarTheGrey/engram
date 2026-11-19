---
date: 2026-11-19
author: claude-agent
type: finding
card: RV3
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** The repository review's finding RV-ADP-4: adoption carries the grants of a file the store dropped, so a grant can outlive the record that held it. Left to card RV4, not fixed here.

**Why.** The fix belongs in core's `packages/core/src/plane/adopt.ts`, which card E2.6 is rewriting now; card RV3 touches the adapters and the no-bypass check only, and editing `adopt.ts` in parallel would collide with E2.6.

**Result.** Nothing changed for it on branch rv3. A backlog row records it for card RV4, to be taken after E2.6 merges, beside the row "Adoption raises trust", which waits on the same rewrite.

**Consequence.** Until card RV4, the twin dogfood's violation report is the check that a grant reaches nobody it should not.

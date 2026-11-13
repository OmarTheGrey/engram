---
date: 2026-11-13
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/plane/offboard-files.test.ts
  - packages/core/test/unit/erased-content.test.ts
  - packages/core/src/plane/read.ts
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** A second adversarial recheck of PR #41 broke the adoption refusal and the read's re-check of cards E9.7 and E2.2 four ways.

**Why.** The refusal matched erased hashes from every item, so another person's file sharing only the text was refused; its strict hash let a case, width or zero-width edit of the erased file back in; it scanned every retire event per candidate inside the write queue. The read re-checked ids only, so a record re-adopted under the erased id served its erased version.

**Result.** The refusal is now per item, by an indexed lookup of that item's erase events, on the merging hash; the read re-reads the whole projection under the lock. Three tests added; breaking either fix fails them.

**Consequence.** ADR 0010's post-merge amendment says so.

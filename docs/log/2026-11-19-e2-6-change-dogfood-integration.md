---
date: 2026-11-19
author: claude-agent
type: change
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/dogfood.ts
  - packages/core/src/oracle.ts
  - packages/core/test/unit/dogfood-cross-handle.test.ts
supersedes: none
---

**What.** The twin dogfood report now knows card E2.6's events: its fixed rule list holds the nine new ids, and the oracle judges a withdrawal (`engram/adopt/withdrawn`) only as a putting back of an earlier version of its item (`restoresEarlier`), never as a grant change or a narrowing by someone other than the owner.

**Why.** Card E9.5 (#48) merged while this card was open; its report replays a member's log, and a withdrawal that restores a grant would have read as a widening by an update event.

**Result.** A log built through the real Plane on two handles, holding a withdrawal, a deferred adoption, an offboarding's mark and report and two deleted records, reports 0 violations; a read planted after it reports 1; a withdrawal restoring no earlier version reports 1. Without the oracle's branch the first test fails. Each new id is a fixed string naming no content, item or principal.

**Consequence.** None.

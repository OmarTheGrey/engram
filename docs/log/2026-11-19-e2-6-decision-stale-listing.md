---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/adopt.ts
  - packages/core/test/unit/plane/cross-handle.test.ts
supersedes: none
---

**What.** Adoption notes the log's head before listing the store and skips, with no event, a record or a retraction for an item the log changed since, counting it under `unchanged`.

**Why.** A listing can predate a committed change or show a write in flight; acting on it retired a freshly changed item (R11, on one handle too) or re-recorded old bytes. Skipping is safe because the next adoption lists again.

**Result.** R11 fails on main and passes here; the AdoptReport shape, and so the HTTP contract, is unchanged.

**Consequence.** A record changed while it was being listed is adopted one read later.

---
date: 2026-11-20
author: claude-agent
type: failure
card: E2.6
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Finding V4-7: the offboarding's sweep makes one `adapter.list` call for every scope the log names.

**Why.** The sweep lists every scope to find records whose lineage traces to erased content.

**Result.** Not changed; a backlog row records it.

**Consequence.** An index of records by lineage, or a bound on the scopes listed, would cut it.

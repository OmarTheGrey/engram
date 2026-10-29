---
date: 2026-10-29
author: claude-agent
type: finding
card: A2
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/plane/replay-workload.test.ts
  - "pnpm --filter adapters exec vitest run test/plane"
supersedes: none
---

**What.** On every registered store (fake with and without search, Mem0, files, Letta) a recorded workload's item set rebuilt from events alone equals the projection, and the store lists exactly what the events stored; the store differs from the projection in status only, for the two items an allowed evict or retire event retired.

**Why.** Gate B criterion 3 asks whether the log reproduces a workload's item set; retention and promotion retire by event and never write the store (ADR 0010, ADR 0025), so "what the store lists" cannot equal the projection field for field.

**Result.** The test asserts the projection's ids and statuses (3 active, 2 retired), the store against the last item each allowed event carried, and identical events across the five stores apart from the store_ref.

**Consequence.** The Gate B record (PR 6) cites this test for criterion 3, with the status-only difference stated, not hidden.

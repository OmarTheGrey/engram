---
date: 2026-10-29
author: claude-agent
type: change
card: B3
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/configs/b3-gatemem-plane.json
  - packages/runner/test/b3.test.ts
  - fixtures/cassettes/b3-gatemem-plane
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/b3-gatemem-plane.json"
supersedes: none
---

**What.** Card B3: the runner's GateMem probe ingests turns and reads through ADR 0030's mapping on the fake and Mem0 stores, and the pipeline config `b3-gatemem-plane` runs one utility, one access-control and one forgetting checkpoint under C5 on both.

**Why.** Gate B criterion 4: GateMem probes run through the plane on every store, from cassettes (plan decision 1).

**Result.** Two offline runs each report 0 new model calls and 12 from cassettes; each results row holds the plane's log (228, 96 and 150 allowed writes, one read). A cross-principal read the mapping forbids yields identical events on both stores (`packages/runner/test/b3.test.ts`). RN1's cassettes were re-recorded once; one of six changed.

**Consequence.** The `letta` store is one line in `packages/runner/src/stores.ts` once PR 2 merges; the live half is exception (c).

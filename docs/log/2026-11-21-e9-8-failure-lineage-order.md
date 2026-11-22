---
date: 2026-11-21
author: claude-agent
type: failure
card: E9.8
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/cli/src/import/bundle.ts
  - "make test-one T=packages/cli/test/import-export.test.ts"
supersedes: none
---

**What.** The first round trip dropped one lineage pointer: rows written in id order put the promoted item before the episode its lineage names.

**Why.** Ids are not always creation order: `engram write --id` lets a caller choose one, and the test's episode id sorted after the minted ones.

**Result.** `lineageOrder` now writes each row after the rows its lineage names; the round trip reports `lineage_dropped: 0`, and the fixture's pointer to a version it does not hold is still dropped and counted (1).

**Consequence.** The bundle stays ordered by id; only the import orders by lineage.

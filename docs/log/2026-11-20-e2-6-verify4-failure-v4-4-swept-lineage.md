---
date: 2026-11-20
author: claude-agent
type: failure
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** Finding V4-4: mutant L7, `removedAncestor` counting erasures only and ignoring swept ids, survived.

**Why.** No test gave a lineage naming a swept id.

**Result.** A test now writes, and has adoption list, an item whose lineage names a never-committed record the sweep took out; both are refused, and L7 fails it on both backends.

**Consequence.** None.

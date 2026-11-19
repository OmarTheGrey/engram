---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/write.ts
  - packages/core/src/plane/adopt.ts
  - packages/core/test/unit/plane/cross-handle.test.ts
supersedes: none
---

**What.** A write under an erased id is refused (`engram/write/erased`), and adoption refuses a record under one (`engram/adopt/erased`) unless the erasure left that record in a store refusing the plane's delete and it has since changed.

**Why.** A record under an id whose record the erasure deleted can only be a store write that was in flight during the erasure, or a restored copy; ADR 0010's rule for records left in a store, which adopts edited content again, stays.

**Result.** The refusal names the erased scope only to its members (finding N3); removing the adoption refusal fails its test on both backends.

**Consequence.** A new memory takes a new id.

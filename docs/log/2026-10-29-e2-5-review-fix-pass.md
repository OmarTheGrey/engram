---
date: 2026-10-29
author: claude-agent
type: change
card: E2.5
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/src/plane/promote.ts
  - packages/core/src/plane/write.ts
  - packages/core/src/content-hash.ts
  - packages/pi-extension/src/bash.ts
  - scripts/check-prose.ts
  - docs/decisions/0026-promotion-corroboration-and-review.md
  - "pnpm exec vitest run packages/core/test/unit/policy/promotion.test.ts packages/core/test/unit/plane/promote.test.ts packages/cli/test/promote.test.ts"
supersedes: none
---

**What.** The fix pass for review P5 (findings P5-1 to P5-13) on promotion.

**Why.** An author could approve its own item by naming another owner; a model could widen confirmed content; expired, retired and already promoted items still counted; a promoter could get an item it cannot read; a rebase left conflict markers.

**Result.** Each finding has a test that failed first: authors and owners cannot review, widenings need a user source, expired items and duplicates are refused, retired confirmers do not count, superseded and still-held content is not retired content, reach is `read`'s, the ref check ignores confirmers, confirmations use a strict normal form, `engram` is blocked in pi's bash, and `make lint-docs` rejects conflict markers. Mutating each rule fails a unit test; invariant 2 also catches authors, widening source, duplicates and reach.

**Consequence.** The CLI's unauthenticated identity is a stated limit in ADR 0026.

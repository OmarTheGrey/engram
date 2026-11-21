---
date: 2026-11-21
author: claude-agent
type: change
card: A5
chapter: implementation
pillar: plane
hypothesis: H3
evidence:
  - packages/adapters/test/plane/revocation.test.ts
  - packages/adapters/test/conformance/meta.test.ts
  - docs/decisions/0013-adapter-contract-and-conformance.md
  - "make test-one T=packages/adapters/test/plane/revocation.test.ts"
  - "pnpm exec vitest run packages/adapters/test/conformance --no-file-parallelism"
supersedes: none
---

**What.** The review fix pass of card A5 (findings A5-1 to A5-8), rebased on main after R3 and E2.7.

**Why.** The review found one important issue and seven minor ones.

**Result.** The lineage rows run in both write orders and pin that the plane ranks two equal hits in the store's order (A5-1). The "closed, rebirth by restore" row asserts the nine `engram/adopt/retract` events that exclude the item (A5-2). The insertions are renamed "through the plane" and "in the store" (A5-8). Superseding entries correct the lineage and rebirth findings (A5-1, A5-3, A5-4), the insertion decision and the honesty limit. The ADR 0013 amendment, `suite.ts` and `validity.ts` cite ADR 0005 (A5-5), the amendment qualifies two claims (A5-6), and a meta-test pins the limit (A5-7). Revocation grid 91 of 91; conformance folder 281 passed, 34 skipped.

**Consequence.** Ready for review again.

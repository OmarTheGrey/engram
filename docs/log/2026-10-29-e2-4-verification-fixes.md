---
date: 2026-10-29
author: claude-agent
type: change
card: E2.4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/retention-review.test.ts
  - packages/core/test/unit/content-hash.test.ts
  - packages/pi-extension/test/retention-status.test.ts
  - docs/decisions/0025-retention-semantics.md
  - "pnpm exec vitest run packages/core/test/unit/plane/retention-review.test.ts"
supersedes: none
---

**What.** Fixes after the verification of PR 4's review fix pass: retirement by an item's own ttl no longer counts as retired content (P4-13), the content hash strips every default-ignorable code point and applies NFKC again (P4-14), only a `person:` scope is an actor's own for ttl retirement (P4-15), the queue refuses only real nesting (P4-16), and the extension's post-sweep status report is tested (P4-17).

**Why.** The verification found a new planting route through the item's own ttl and four smaller defects.

**Result.** Four new tests failed on the fix-pass head and pass now; the P4-17 test was shown red by making the correction a no-op. Each of seven mutants turns a test red. The orchestrator's decisions on P4-4 and P4-13 are in ADR 0025's amendments.

**Consequence.** Budget flooding stays a recorded residual for the lead.

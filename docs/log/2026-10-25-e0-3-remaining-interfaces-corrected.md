---
date: 2026-10-25
author: claude-agent
type: change
card: E0.3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - docs/architecture.md
  - packages/core/test/unit/interfaces.test.ts
  - "pnpm --filter core test"
supersedes: docs/log/2026-10-25-e0-3-remaining-interfaces.md
---

**What.** Corrects two stale statements in the card E0.3 entry: its test count and its consequence about the architecture's interface list.

**Why.** Review finding R2-5 on PR #2. The entry was written before the last commit of PR #2, which added the injected time to the architecture's signatures.

**Result.** `docs/architecture.md` now lists `write(actor, itemIn, at)` and `promote(actor, itemId, toScope, at)`, so the claim that it omits `at` no longer holds. At the head of PR #2, `pnpm --filter core test` ran 83 tests, not 64; after the review fix pass it runs 114, with 8 in `interfaces.test.ts`.

**Consequence.** Nothing changes in the code; the rest of the superseded entry stands.

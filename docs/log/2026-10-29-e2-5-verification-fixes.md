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
  - packages/core/src/content-hash.ts
  - packages/pi-extension/src/bash.ts
  - packages/pi-extension/test/engram-cli-block.test.ts
  - docs/decisions/0026-promotion-corroboration-and-review.md
  - docs/decisions/0014-no-bypass.md
  - "pnpm exec vitest run packages/core/test/unit/policy/promotion.test.ts packages/core/test/unit/plane/promote.test.ts packages/cli/test/promote.test.ts"
supersedes: none
---

**What.** Fixes for the verification of review P5 (findings P5-14 to P5-18).

**Why.** A read-only grantee could move a person's item into a team and retire it. A tag-character payload rode plain confirmations into a wider scope. A confirmer could approve. Invariant 2 missed the confirmer-status rule, and the CLI's package and script routes passed pi's bash check.

**Result.** Each fix has a test that failed first: the grantee probe is refused under `engram/promote/membership`; the payload under `engram/promote/hidden-text`, and plain restatements no longer confirm it; a confirmer is refused as reviewer; nine CLI routes are blocked in a real pi session. Mutating out membership, hidden text, confirmer review or confirmer status fails both unit tests and invariant 2.

**Consequence.** Inside pi in this repository, commands naming `packages/cli` are refused too (ADR 0014's amendment).

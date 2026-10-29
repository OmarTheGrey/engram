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
  - packages/pi-extension/test/retention-status.test.ts
  - packages/cli/test/read.test.ts
  - docs/decisions/0025-retention-semantics.md
  - "pnpm exec vitest run packages/core/test/unit/plane/retention-review.test.ts"
supersedes: none
---

**What.** The review fix pass of PR 4 (findings P4-1 to P4-12): a write is never its own budget victim, expired items hold no slot, only an event retires content, reasons are redacted for non-readers, ttl retirement of shared scopes needs a user, format characters are stripped, nested queue calls throw, adoption reports evictions and retracts in the queue, and a manual overage asks once per state.

**Why.** The independent review found them with probes.

**Result.** Thirteen new tests reproducing the findings failed on the reviewed code and pass now (the CLI test for P4-10 was shown red by removing the new output). Mutating each fix (P4-1, 2, 3, 4, 6, 8, 12) turns a unit test red; P4-1, 2, 6 and 12 also turn invariant 5 red.

**Consequence.** An `engram retain` command for user-sourced sweeps of shared scopes is a follow-up; P4-5 needs the next schema PR.

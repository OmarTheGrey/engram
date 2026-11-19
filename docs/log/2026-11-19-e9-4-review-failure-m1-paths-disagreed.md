---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** Review finding M1 of PR #44: `Plane.write` and `changeGrants` disagreed on what a grant may be.

**Why.** The write path accepted an expired grant and a duplicate, which `changeGrants` refused, and `changeGrants` accepted a grant of another class than the item's, which could never admit a read.

**Result.** `grantDefect` in `packages/core/src/policy/evaluate.ts` is now the one check; the outcome is decision `2026-11-19-e9-4-review-decision-m1-first-writes.md`.

**Consequence.** Open question in ADR 0034 for the lead.

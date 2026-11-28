---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/src/plane/approvals.ts
  - docs/absorbed.md
  - "make test-one T=packages/core/test/unit/plane/approvals.test.ts"
supersedes: none
---

**What.** An approver may pin the version they reviewed (`reviewedVersion` on promote and refuse); a promotion or refusal of any other version is refused under `engram/approval/stale`, ported from obsidian-wiki's staging (MIT, at `7da8def05ab4`), read at that commit.

**Why.** The card names that source's stale-base refusal. Without a pin, a rewrite between an approver's look and their approval would let the approval land on content they never saw.

**Result.** Two unit tests; 30 passed. With the evaluator's check disabled, the stale test fails.

**Consequence.** Card E8.8's surfaces should pass the version the queue showed. Without a pin the call behaves as before.

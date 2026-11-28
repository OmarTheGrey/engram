---
date: 2026-11-28
author: claude-agent
type: change
card: E9.16
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/audit/ropa.ts
  - packages/core/test/unit/audit/ropa.test.ts
  - packages/cli/src/audit.ts
  - docs/compliance/ropa-medium.txt
supersedes: none
---

**What.** `engram audit ropa [--policy] [--db] [--json]` prints core's `ropaRecord`: per scope level the data subjects, the classes the write rules admit and on what terms, the reader levels and grants, the retention rules, the erasure mode and the measures the policy turns on, with counts by class and status from the log when --db names one.

**Why.** GDPR Article 30(1) in the crosswalk; the card's step 3. The field list is the Regulation's; CIRCL/compliance and gdprropa were read for ideas only.

**Result.** The record over the acceptance's fixture log under medium is `docs/compliance/ropa-medium.txt`, matched byte for byte; no content, item id, scope id or actor appears in text or JSON.

**Consequence.** Claim C53 points at these tests.

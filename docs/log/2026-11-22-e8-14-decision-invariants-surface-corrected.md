---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: docs/log/2026-11-21-e8-14-decision-invariants-surface-classified.md
---

**What.** The invariants file's surface check classifies `readById` and `listScopes`, with the review's additions, and the review approved it as second reviewer.

**Why.** The earlier entry said nothing else in the file changed and that a second reviewer was still needed; findings E8.14-1 and E8.14-5 asked for more.

**Result.** The case also writes a second hidden item whose grant to the outsider names another class, and compares each by-id answer with an unknown id's as a whole, reason included, ids neutral. After merging main (E2.11's eighth invariant) `make test-invariants` passes 18 of 18.

**Consequence.** Nothing further.

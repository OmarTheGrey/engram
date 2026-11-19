---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** A write that changes grants is also judged by the oracle's `writeForbidden`, with the declared actor (or the CLI's default for another principal) and the source the item records.

**Why.** The reviewer's plant R7: a non-member's first write naming itself the owner and granting itself passed the owner check, since a first write's owner is as written.

**Result.** R7 is now `grant_change` 1; so is a write by another member that drops a grant, since a non-member may not write the item.

**Consequence.** A non-member's write that changes no grant is still not judged: invariant 2 is not the report's.

---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.19
chapter: design
pillar: govern
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/test/unit/plane/approvals.test.ts
supersedes: none
---

**What.** `exportCedar` exports a policy with an approval block faithfully, adding one header line that names its routes as not exported, instead of refusing it.

**Why.** The export covers the read and write gates, not the promotion gate (ADR 0041); the block changes neither, so refusing would refuse a faithful export.

**Result.** A unit test: the export with the block equals the export without it but for that line; schema and rules identical.

**Consequence.** Nothing registered sets the block, so no Cedar result moves.

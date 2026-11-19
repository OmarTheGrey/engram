---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/commit.ts
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
supersedes: docs/log/2026-11-19-e2-6-verify-decision-recovery-narrows.md
---

**What.** A narrowing removes a grant only if every allowed version since the adoption carried it without a break.

**Why.** A grant the owner removed and added again after the adoption is the owner's decision, which recovery never undoes.

**Result.** Q3b passes; narrowing regardless fails it.

**Consequence.** None.

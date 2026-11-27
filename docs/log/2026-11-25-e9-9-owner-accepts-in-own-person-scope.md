---
date: 2026-11-25
author: claude-agent
type: change
card: E9.9
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/promotion.ts
  - packages/core/test/unit/plane/owner-accepts.test.ts
  - packages/core/test/unit/policy/promotion.test.ts
  - "make test-one T=packages/core/test/unit/plane/owner-accepts.test.ts"
supersedes: docs/log/2026-11-22-e9-8-finding-owner-acceptance-after-tag.md
---

**What.** In a person scope its owner, user-sourced at the person level, now accepts a semantic candidate of that scope in place, under `engram/promote/owner-person`.

**Why.** A person alone could not read their own imported memories, nor release a screen hold on their own agent's note (card E9.8's open item; the lead asked on 2026-11-25 for it to be resolved).

**Result.** `ownCandidate` and `evaluatePromotion` decide it; any other source is refused under `engram/promote/reviewer` with a reason naming the rule. The acceptance test passes, 16 tests; the evaluator's file 68. Seven mutants of the rule, each killed by one of the two files.

**Consequence.** Shared scopes, widenings, episodic and procedural candidates keep ADR 0026's reviewer.

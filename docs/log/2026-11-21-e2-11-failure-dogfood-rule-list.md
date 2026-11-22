---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.11
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/dogfood-report.test.ts
  - packages/core/src/dogfood.ts
supersedes: none
---

**What.** The core unit run failed one test: every `engram/` rule id core names must be on the dogfood report's list.

**Why.** `engram/write/downgrade` was new.

**Result.** Added to `ENGRAM_RULES`; `make test-one T=packages/core/test/unit/dogfood-report.test.ts`: 44 passed.

**Consequence.** None.

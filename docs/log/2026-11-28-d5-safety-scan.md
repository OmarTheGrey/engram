---
date: 2026-11-28
author: claude-agent
type: change
card: D5
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/lint/procedural.ts
  - packages/core/test/unit/lint/procedural.test.ts
  - "make test-one T=packages/core/test/unit/lint/procedural.test.ts"
supersedes: none
---

**What.** `packages/core/src/lint/procedural.ts`: a pure scan of a procedural item's body and each tool for shell injection, destructive commands, exfiltration sinks and prompt-injection phrases, 33 rules as a table, each finding a rule, class, severity, field and offsets.

**Why.** Card D5: a replay proves a procedure works, not that it is safe (2602.06547).

**Result.** The tables are ported from caura's `sentinel_scan.py` (Apache-2.0, at 8dbb7f40, `docs/absorbed.md`, NOTICE), with credential and concealment rules taken as ideas from devmemory and the paper. The acceptance test passes, 102 tests: a case per class with near-miss controls, wipe-target resolution, logical lines, a linear-time check on long adversarial lines. Mutation check: holding only on two or more critical findings fails four hold tests.

**Consequence.** English and shell-centred; evadable by construction. A floor, never a defence.

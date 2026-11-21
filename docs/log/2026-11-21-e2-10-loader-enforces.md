---
date: 2026-11-21
author: claude-agent
type: change
card: E2.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
  - packages/core/test/unit/policy/load.test.ts
  - "make test-one T=packages/core/test/unit/policy/load.test.ts"
supersedes: none
---

**What.** The loader's `NOT_ENFORCED_YET` table (card E2.8, PR #72) loses its `injection_screen` entry, so a policy file may now set `content_guards.injection_screen` to default or hardened; the option test expects every value to load for an option whose card has landed.

**Why.** E2.8's loader refuses an option until the card that enforces it lands, and this card enforces this one. The other options stay refused for cards E2.9 and E2.11.

**Result.** The load, schema, preset and screen tests pass: 413 tests in 12 files on the branch rebased onto `origin/main` at `1c458f0`; `make test-invariants` passes 8 of 8. `engram simulate` with a policy file setting the default screen loads and reports 3 items returned against 1.

**Consequence.** None for the registered presets, which leave the block out.

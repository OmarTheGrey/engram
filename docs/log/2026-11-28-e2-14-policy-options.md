---
date: 2026-11-28
author: claude-agent
type: change
card: E2.14
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/schema.ts
  - packages/core/src/policy/load.ts
  - packages/core/test/unit/policy/load-options.test.ts
supersedes: none
---

**What.** The policy gains seven optional options for later cards: `lints.model.evidence` (L9), `procedures.safety_scan` (D5), `procedures.drift` (D4), `consent` (E9.12), `erasure.mode` (E9.13), `approval` (E2.19) and `grants.expiry_cap` (E2.21, part 2), each without a default, and the loader refuses every present value, naming its card.

**Why.** Rule 5 keeps schema changes to one pull request, so seven cards share this one, under ADR 0002's decision D2 (no `schema_version` bump).

**Result.** `make test-one T=packages/core/test/unit/policy/load-options.test.ts`: 37 passed. The three registered presets parse to the sha256 E2.8 recorded; no bundled preset or profile sets an option. Mutants killed: dropping consent's refusal row (4 tests fail), letting `off` through (3 fail).

**Consequence.** Each consuming card deletes its row of `NOT_BUILT_YET` in `policy/load.ts` and its row of the test's `NOT_BUILT` table, with a loader test of its own.

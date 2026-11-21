---
date: 2026-11-21
author: claude-agent
type: change
card: E2.8
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/load.ts
  - packages/core/test/unit/schema.test.ts
  - packages/core/test/unit/policy/load.test.ts
  - docs/decisions/0002-schema-and-generated-contracts.md
  - "make test-one T=packages/core/test/unit/policy/load.test.ts"
supersedes: none
---

**What.** The review fix pass of card E2.8, findings E2.8-1 to E2.8-8.

**Why.** The review found three mutations every test passed, a decision D2 broader than migration 4's history allows, and options that loaded while nothing enforced them.

**Result.** The option values are pinned in `schema.test.ts`, which failed for each mutation: "off" renamed "none" (1 test), "default" renamed "standard" (1), and an extra value (2). Each value of each option passes the schema in `load.test.ts`. The loader refuses any value but `off`, naming the card that will enforce it (E2.9, E2.10 or E2.11); removing one entry from that table failed 1 test. A YAML 1.1 boolean gets a quoting hint. D2 is now an exception for never-persisted contracts, named in rule 5 and recorded in `lead-decisions.md`. The `injection_screen` JSDoc and `docs/architecture.md` are corrected.

**Consequence.** Cards E2.9, E2.10 and E2.11 each delete their own entries from `NOT_ENFORCED_YET`.

---
date: 2026-11-21
author: claude-agent
type: failure
card: E2.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/policy/secrets.test.ts
supersedes: none
---

**What.** The first run of the acceptance file failed 15 of 381 tests.

**Why.** Overlaps were resolved longest-first, after caura, so a heuristic rule whose run swallowed the key name (`DB_PASSWORD=...` as one high-entropy run) or an email inside a URL hid the specific rule; the leak test also expected an item on the read event; three test vectors were wrong (an IBAN's length, a 10-digit UK number that is valid, an org write by a non-member).

**Result.** Resolution changed to tier, then table order (see its decision); the test fixes were to the tests' own facts. The file then passed 381 of 381.

**Consequence.** None beyond the decision.

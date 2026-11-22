---
date: 2026-11-21
author: claude-agent
type: milestone
card: E1.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/chain.test.ts
  - make test-invariants
supersedes: docs/log/2026-11-21-e1-6-milestone-chain-invariant.md
---

**What.** After the fix pass, make test-invariants passes with the chain invariant on SQLite and embedded Postgres: 3 files, 21 tests.

**Why.** The card's acceptance, rerun after the review fixes and the merge of main at d763deaa.

**Result.** Every run holds a lint event about a surviving item redacted at offboarding, verifies UNSIGNED, then OK under a pinned signed checkpoint, and each of 26 tampers is caught by the check it names: 40 runs on SQLite, 10 on Postgres, every tamper met on each backend.

**Consequence.** AGENTS.md counts nine invariants, the ninth this one.

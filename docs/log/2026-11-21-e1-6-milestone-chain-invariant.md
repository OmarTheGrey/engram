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
supersedes: none
---

**What.** The chain invariant, the ninth, runs in make test-invariants on SQLite and on embedded Postgres.

**Why.** Card E1.6 step 8 and its acceptance command.

**Result.** Over random writes, rewrites, citations, reads and lints by two people, an offboarding of one with a role handover, and writes after it, the log verifies (UNSIGNED, then OK after a signed checkpoint), and each of ten tampers is detected: an edited body, a deleted event, two events reordered, a truncated tail, a tail truncated with its head rewritten (against a held checkpoint), a rewritten reason, an edited lint evidence, an edited owner, edited content and a forged redaction. Guards require redacted item events and a redacted lint event about an item not erased. 40 runs on SQLite, 10 on Postgres.

**Consequence.** AGENTS.md and CLAUDE.md count nine invariants.

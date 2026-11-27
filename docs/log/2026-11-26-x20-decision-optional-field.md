---
date: 2026-11-26
author: claude-agent
type: decision
card: X20
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_answer_refused.py
supersedes: none
---

**What.** A refused utility session's `exclusion` is an optional use of `h1-sessions/2`'s existing field, with no `h1-sessions/3` and no version bump.

**Why.** Review N6 and the coordinator: card X21 made `capped` an optional field of version 2 for the same reason. A file written before the card has no utility row with an exclusion, so it parses and builds as before.

**Result.** h1.py accepts an exclusion on a utility row only with a null `utility_ok`, and writes `utility_exclusions` in an MGS entry only when one is present; the existing H1 pipeline, secondary, evidence and exclusions tests pass unchanged (32).

**Consequence.** The converter and the table agree without a schema migration; after X21 merges, one reconciled count of utility sessions out of U.

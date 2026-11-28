---
date: 2026-11-28
author: claude-agent
type: failure
card: X16
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/gate_mutation_audit.py
supersedes: none
---

**What.** The first exploration run read vitest's JSON reporter and classified 26 of the first 33 mutants as could-not-tell.

**Why.** Fast-check reports a failed property as an `Error` ("Property failed after n tests") whose `cause` is what the predicate threw; vitest's JSON reporter keeps only the outer error's stack, so an `AssertionError` inside and a `TypeError` inside looked the same, and only the kills outside a property (invariant 1's surface check) read as assertions.

**Result.** The script now writes a small reporter into the copy that records every error as its chain of causes, name and message. Rerun on two mutants, both read as assertions (`I2-membership-ignored`, `I3-read-two-events`).

**Consequence.** None for the committed code; the classification tests use the reporter's format.

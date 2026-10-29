---
date: 2026-10-29
author: claude-agent
type: failure
card: B2
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/bench/PINS.md
  - research/tests/test_prereg.py
supersedes: none
---

**What.** MEM-INV-Bench's row was first added to the pins table itself, and `make test` failed: `test_the_six_benchmarks_are_the_pinned_ones` holds that table to the six benchmarks the pre-registration registers.

**Why.** A pinned benchmark is a registered one; AGENTS.md forbids a benchmark the pre-registration does not name, and the plan's "row in PINS.md" did not say where.

**Result.** The row moved to a "Candidates checked, not registered" table after the notes, with the same columns ("commit at the check" for "pinned commit"); the test passes again.

**Consequence.** If the poisoning arm moves to MEM-INV-Bench at Gate B, a pre-registration amendment comes first and the row then moves up.

---
date: 2026-11-20
author: claude-agent
type: failure
card: RV8
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_frontier_axes.py
supersedes: none
---

**What.** `make test` run beside the 16 frontier processes failed 31 of 3,283 tests in 15 files (Letta adapter, conformance on Letta, doctor, B3, the lint counts).

**Why.** Load: 23 of the failures are `Test timed out`, the others a Letta lock held by a timed-out sibling and EBUSY on temporary folders. None of the files touches this card's code.

**Result.** The 15 files were rerun with four workers once the machine was quieter; their result is in the change entry for the frontier and in the report.

**Consequence.** Run `make test` alone, not beside a long measurement.

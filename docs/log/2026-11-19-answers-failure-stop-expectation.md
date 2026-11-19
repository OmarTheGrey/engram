---
date: 2026-11-19
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_label_audit.py
supersedes: none
---

**What.** The new three-member rejection test failed after the implementation, on its own expectation that neither benchmark stops.

**Why.** Its planted MEM-INV-Bench sheets reject 4 of the 38 cases, which is above `stop_share` (0.10), so `stop` is rightly true; the test was written expecting false.

**Result.** The code was right and the test wrong: the assertion now expects GateMem's 2 of 50 to stay below the threshold and MEM-INV-Bench's 4 of 38 to stop, which also checks the threshold under three members. The other five new tests had failed first for the expected reason (no three-member support).

**Consequence.** None beyond the corrected assertion.

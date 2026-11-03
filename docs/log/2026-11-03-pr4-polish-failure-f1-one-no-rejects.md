---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
supersedes: none
---

**What.** The final verifier found that turning `all(...)` into `any(...)` on the `both_no` line of `label_audit_agreement.py`, so that one member's no rejects an item, survived every test (F-1).

**Why.** Every stop-rule test gave both members identical key sheets; the one test where they differ checked the key agreement, not the rejections.

**Result.** That test, where only one member says no on G01 and M01, now asserts no rejection and no stop on both benchmarks. The mutant is killed.

**Consequence.** A rule that needs both members is tested where they disagree.

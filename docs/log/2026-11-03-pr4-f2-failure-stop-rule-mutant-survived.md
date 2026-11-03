---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
supersedes: none
---

**What.** One of seven mutants of this round's audit and H4 work survived: counting GateMem items both members label otherwise than the expected action as rejected passed every test.

**Why.** No test had both members contradict GateMem's expected action, so including it changed nothing.

**Result.** A test now has both give another action on 10 of 50 items while accepting every key: no rejection, no stop. The mutant is killed; the other six were killed at once.

**Consequence.** A rule's exclusions need a test as much as its inclusions.

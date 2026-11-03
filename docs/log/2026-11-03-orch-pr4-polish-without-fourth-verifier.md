---
date: 2026-11-03
author: claude-orchestrator
type: decision
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_agreement.py
  - docs/research/prereg-v1-decisions.md
supersedes: none
---

**What.** After PR 4's final verifier found it ready to merge with eight minor findings, a short polish round fixed them, and the orchestrator checked that round's diff and gates itself instead of sending it to a fourth verifier.

**Why.** Two of the findings bore on what the lead reads or relies on: the main table's MGS differs from the figure in the run's own summary, and no test held the audit's stop rule to both members rejecting. The rest were small, so another verification round would have cost more than it could find.

**Result.** The polish round's changes are each a test, a log entry, a citation, a wording or one table field, with every gate rerun.

**Consequence.** PR 4 merges after the polish round.

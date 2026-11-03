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

**What.** MEM-INV-Bench's phase-1 contexts showed each memory entry's channel and derivation, which the model does not see under C2 and C3 (P4V-6).

**Why.** Part A copied the vendored case's fields into the context without checking what each condition shows.

**Result.** Phase 1 now shows each entry's text alone (`2026-11-03-pr4-f2-audit-contexts`).

**Consequence.** "What an agent sees" is checked against the conditions, not the data file.

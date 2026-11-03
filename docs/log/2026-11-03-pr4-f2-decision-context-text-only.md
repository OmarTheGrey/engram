---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
supersedes: none
---

**What.** A MEM-INV-Bench phase-1 context lists each memory entry's text alone, without its entry id, channel or derivation (D6). The phase-1 test compares every context with a rebuild from the data, the first of P4V-2's two options.

**Why.** Under C2 and C3, `memory_read` returns the text only. A rebuild catches any addition, where a word list catches only the words it names.

**Result.** Phase 2 is unchanged: it shows the scoring keys.

**Consequence.** If phase 2 should show channels, its sheet gains a column; phase 1 stays text only.

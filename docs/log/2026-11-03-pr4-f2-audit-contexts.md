---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
  - docs/research/label-audit.md
supersedes: none
---

**What.** MEM-INV-Bench phase-1 contexts list each entry's text alone. The phase-1 test checks every context against its agent-visible rebuild from the data.

**Why.** Shared design D6 (P4V-6) and P4V-2.

**Result.** Three mutants are killed: GateMem's expected action appended after the turns, MEM-INV-Bench's scenario name appended after the memory, and the channel shown again. The docstring and the how-to say text only.

**Consequence.** Phase 2 still shows the keys.

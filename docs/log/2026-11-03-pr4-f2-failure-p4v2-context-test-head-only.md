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

**What.** The phase-1 test searched only each context's head for labels, so a label appended after the turns or the memory would have passed (P4V-2).

**Why.** The test treated the content as safe because it is what an agent sees, without checking that it is only that.

**Result.** Each context must now equal its agent-visible rebuild from the data; appending the expected action (GateMem) or the scenario name (MEM-INV-Bench) fails it (`2026-11-03-pr4-f2-audit-contexts`).

**Consequence.** A blindness test compares the whole artefact with what may be seen.

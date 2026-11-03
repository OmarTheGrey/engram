---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
supersedes: docs/log/2026-11-03-pr4a-decision-audit-labels.md
---

**What.** The audit labels the same things (GateMem's expected action at 25 access-control and 25 forgetting checkpoints; MEM-INV-Bench's family for 38 cases), blind: phase 1 shows only what an agent sees, items named G01 or M01 in one seeded order mixing the kinds; phase 2, refused until phase 1 is complete, shows the scoring keys for a yes or no.

**Why.** The superseded design showed members the label they audited (review P4A-3).

**Result.** References replace item ids, since a GateMem id can name the kind ("deleted"). No key file exists: the agreement script recomputes the seeded draw from the pinned data. Leak targets and poisoned values still appear inside the turns and memory, the content judged; their marking is withheld.

**Consequence.** The agreement needs the pinned GateMem data, as the draw does.

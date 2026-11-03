---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - docs/research/label-audit.md
supersedes: none
---

**What.** The first label-audit kit showed members the answer: sheets had a `benchmark_label` column, GateMem contexts opened with the expected action and leak targets, MEM-INV-Bench contexts printed the family and scoring keys, and the agreement read the benchmark label from an editable sheet.

**Why.** It was built to check labels shown beside the item, not as a second labelling; and as all 25 forgetting items are `no_memory`, showing the kind showed the label. Found by the review (P4A-3).

**Result.** Redesigned in two phases (`pr4a-r1-decision-audit-design`). A test asserts no phase-1 sheet or context holds an item's label, key, family or kind; mutants restoring the expected action, writing phase 2 early, or keeping the sampled order fail it.

**Consequence.** An audit measuring agreement shows its members nothing to agree with.

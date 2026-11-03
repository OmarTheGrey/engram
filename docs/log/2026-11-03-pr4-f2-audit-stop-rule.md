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
  - research/configs/label-audit.json
  - docs/research/label-audit.md
supersedes: none
---

**What.** `research/configs/label-audit.json` gains `stop_share` (0.10). `agreement.json` gives per benchmark `rejected` (`rule`, `refs`, `count`), `stop_share` and `stop`. On GateMem an item is rejected when both members answer no on the keys; on MEM-INV-Bench, when both label otherwise than the family or both answer no on the keys.

**Why.** Shared design D4 (V-5).

**Result.** Synthetic sheets: GateMem 5 of 50 does not stop and 6 does; MEM-INV-Bench 3 of 38 does not and 4 does; an overlap counts once; expected-action disagreement stops nothing; the flag waits for keys. Three mutants are killed. The how-to is updated.

**Consequence.** Part B's item 16 matches this rule.

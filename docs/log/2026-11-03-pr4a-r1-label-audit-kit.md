---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - research/configs/label-audit.json
  - research/tests/test_label_audit.py
  - docs/research/label-audit.md
supersedes: docs/log/2026-11-03-pr4a-label-audit-kit.md
---

**What.** The label-audit kit in two phases: `label_audit_sample.py` writes blind phase-1 sheets and contexts, and with `--phase 2 --member <name>` that member's key sheets; `label_audit_agreement.py --config` computes the agreement with labels from the seeded draw.

**Why.** Review P4A-3: the first kit showed the labels being audited.

**Result.** Before: sheets with `benchmark_label` and `benchmark_targets`, contexts headed by the label, agreement read from the sheet. After: phase-1 sheets with `ref`, `benchmark`, `context`, `member_label`, `member_comment`; phase-2 sheets with `scoring_keys` and `member_keys_ok`; a real draw gives 50 GateMem references whose kinds alternate in seeded order and 38 MEM-INV-Bench references, with no checkpoint id or label word in any head. Ten tests, three mutants killed.

**Consequence.** `docs/research/label-audit.md` is rewritten for the two phases; part B cites it in v1.

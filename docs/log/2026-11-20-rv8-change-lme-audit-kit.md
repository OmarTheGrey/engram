---
date: 2026-11-20
author: claude-agent
type: change
card: RV8
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - research/configs/label-audit-longmemeval.json
  - research/tests/test_label_audit.py
  - docs/research/label-audit.md
supersedes: none
---

**What.** LongMemEval has a label-audit kit: a seeded draw of 50 questions, one blind sheet and one key sheet per member (Omar, Mohamad, Shady), and the same agreement and stop computation the H1 kit uses.

**Why.** RV-DES-17: H2 and H3 run on LongMemEval, and the pre-registration audits 50 items per benchmark before its first run.

**Result.** Phase 1 asks answerable or unanswerable (the abstention label) and shows the question and its evidence sessions only; phase 2 shows the benchmark's answer. An item is rejected when `reject_quorum` members label it otherwise or answer no on the key, as on MEM-INV-Bench. `reject_quorum` and `on_stop` are now config values in both audit configs; the agreement reports them per benchmark. 31 audit tests pass (`uv run pytest research/tests/test_label_audit.py`).

**Consequence.** The audit of 23 to 28 November can cover LongMemEval with the same three members.

---
date: 2026-11-20
author: claude-agent
type: measurement
card: RV8
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-label-audit-longmemeval.json
  - "uv run python research/scripts/label_audit_draw.py --config research/configs/label-audit-longmemeval.json --out research/results/h2-label-audit-longmemeval.json"
supersedes: none
---

**What.** LongMemEval's audit draw recorded without any id, label or key, MANIFEST row research/results/h2-label-audit-longmemeval.json.

**Why.** RV-DES-17; the members' sheets and context files can be checked against a committed draw before the audit.

**Result.** 50 questions: knowledge-update 8, multi-session 14, multi-session with abstention 1, single-session-assistant 5, single-session-preference 2, single-session-user 8, temporal-reasoning 11, temporal-reasoning with abstention 1. The stop trips at 6 rejected. Each reference's context sha256 and one `draw_sha256` over the hidden fields are recorded.

**Consequence.** Only 2 abstention questions are drawn, so the answerability label is checked on few unanswerable items; a stratified rule would change that (see the finding on the rule).

---
date: 2026-11-26
author: claude-agent
type: change
card: R5
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/configs/label-audit.json
  - research/configs/label-audit-longmemeval.json
  - research/tests/test_label_audit.py
  - docs/research/preregistration.md
  - "uv run pytest research/tests/test_label_audit.py"
supersedes: docs/log/2026-11-21-answers-finding-on-stop-moves-results.md
---

**What.** Both label-audit configs now read `"on_stop": "drop"`, the two config tests pin it, and the pre-registration's Benchmarks sentence and pre-tag condition 2 say so.

**Why.** Lead-decisions item 6 answered (a), drop a tripped stop's rejected items, list them in v1 and proceed; the configs still named `pause`, and the agreement script reads the field.

**Result.** The two config tests failed on `pause` first (2 failed, 31 passed), then passed after the config change: `33 passed`. Condition 2 is marked "Done on 2026-11-26". The draws did not move (see the two measurement entries), so any sheet a member already holds stays valid.

**Consequence.** An agreement computed from here on applies `drop` when a stop trips. No audit agreement is committed in this repository as of this card (research/results holds none), so none is computed again.

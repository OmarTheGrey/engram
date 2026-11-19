---
date: 2026-11-19
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/scripts/label_audit_agreement.py
  - "uv run pytest research/tests/test_label_audit.py"
supersedes: none
---

**What.** The review of PR #43 (findings P43-1 to P43-8) is fixed in new commits, one `failure` entry per finding.

**Why.** Nothing may be written in the lead's name beyond what he said, and the kit must not report a three-member audit on two members.

**Result.** The two-of-three rule is the orchestrator's everywhere; items 1 and 20 carry no prediction; ADR 0018's amendment is pending again and is the backlog's one item for the lead; ADR 0015's amendment separates his answer from the proposal; `--members` is checked against the config; MPBench's request is "not sent", a default he left standing; X2 and X3 updated. Edited in place, all unmerged: the entries `lead-decision-16-three-members`, `lead-decision-spend-undecided`, `lead-decision-mpbench-not-sent`, `lead-decision-adrs-accepted` and `orch-decision-two-of-three`. Section 7 says why six MANIFEST rows name `2c503aa`.

**Consequence.** None beyond the fixes.

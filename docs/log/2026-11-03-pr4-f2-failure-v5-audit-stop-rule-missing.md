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
  - research/configs/label-audit.json
supersedes: none
---

**What.** The decision sheet's audit stops a benchmark when both members reject more than 10 percent of its items, but the agreement script computed no rejections and no stop flag, and put the stop on the expected action, which decides no violation (V-5).

**Why.** Part A built the agreement around disagreement rates and kappa and left the rule to the text.

**Result.** The script applies `stop_share` from the config to the items both reject on what decides a violation (`2026-11-03-pr4-f2-audit-stop-rule`).

**Consequence.** A stopping rule lives in code with its threshold in a config, not only in prose.

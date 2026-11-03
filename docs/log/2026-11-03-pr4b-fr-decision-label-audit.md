---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/configs/label-audit.json
supersedes: docs/log/2026-11-03-pr4b-decision-label-audit.md
---

**What.** Recommended, for the lead's decision: the audit's 10 percent rule sits on what decides a violation (decision sheet item 16).

**Why.** the final verification of PR #27 (V-5): the rule sat on the benchmark's label, which on GateMem is the expected action, a label no violation depends on.

**Result.** GateMem: an item is rejected when both members answer no on the scoring keys. MEM-INV-Bench: when both members' blind label differs from the family, or both answer no on the keys. The threshold is `stop_share`, 0.10, in `research/configs/label-audit.json`; the script records `stop` per benchmark. Phase-1 contexts on MEM-INV-Bench show no channel.

**Consequence.** The expected-action agreement is reported, not a stopping rule.

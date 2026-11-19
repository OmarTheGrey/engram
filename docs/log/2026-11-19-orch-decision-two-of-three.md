---
date: 2026-11-19
author: claude-orchestrator
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_agreement.py
  - research/tests/test_label_audit.py
  - docs/research/label-audit.md
supersedes: docs/log/2026-11-03-pr4-f2-decision-audit-stop.md
---

**What.** With three auditors an item is rejected when at least two of the three reject it, and the agreement reports Cohen's kappa for each pair of members and Fleiss' kappa over the three; this is the orchestrator's rule, for the lead to confirm.

**Why.** The lead named three members (decision sheet item 16), and the two-member rule ("both reject") has no single reading for three.

**Result.** On GateMem, two answers of no on the scoring keys reject; on MEM-INV-Bench, two blind labels that differ from the family, or two answers of no on the keys, each kind counted on its own. `stop_share` stays 0.10 with the same counts; `stop` stays null until every member's key sheets exist, unless the rejections already pass the threshold. With two members the report is unchanged.

**Consequence.** If the lead prefers "all three" or "any one", one constant (`REJECT_QUORUM`) and its tests change.

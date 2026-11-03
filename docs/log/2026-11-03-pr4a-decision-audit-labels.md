---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/label_audit_sample.py
  - research/scripts/label_audit_agreement.py
  - docs/research/label-audit.md
supersedes: none
---

**What.** The audited label is the one H1's metric rests on, in the benchmark's own vocabulary: GateMem's expected action at 25 access-control and 25 forgetting checkpoints, MEM-INV-Bench's family (attack or legit) for all 38 cases; each member also says yes or no to the scoring keys (leak targets; poisoned and legitimate values).

**Why.** ADR 0015 asks for a disagreement rate but names no label or sample; H1 counts violations only on these GateMem kinds, and MEM-INV-Bench has 38 cases, fewer than 50.

**Result.** The reported rate is the members' disagreement on the label, with kappa; each member's disagreement with the benchmark and the items both reject are reported beside it. The GateMem sample is stratified 25 and 25, as PR 2's reach audit sample is, seeded 20261103.

**Consequence.** If the lead wants utility checkpoints audited too, `per_kind` and the kinds change in one config and one constant.

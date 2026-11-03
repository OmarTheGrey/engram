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
  - docs/research/label-audit.md
  - docs/decisions/0015-evaluation-protocol.md
supersedes: none
---

**What.** Recommended, for the lead's decision: two members the lead names audit H1's labels in two phases, blind labelling and then the scoring keys, after the lead's answers and before the tag; a benchmark's runs wait for an amendment if both reject its label on more than 10 percent of the audited items (decision sheet item 16).

**Why.** ADR 0015 asks for the audit and a disagreement rate but names no stopping point; `docs/research/label-audit.md` lists rejected items in v1, which needs the audit before the tag.

**Result.** More than 10 percent is 6 or more of 50 GateMem checkpoints and 4 or more of 38 MEM-INV-Bench cases; ADR 0015's context cites a six percent label error rate on LoCoMo (Ground Truth First).

**Consequence.** The members' kappa is reported, not used to stop.

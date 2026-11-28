---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.21
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/scripts/gate_mutation_audit.py
  - research/configs/gate-mutation-audit.json
supersedes: none
---

**What.** The first full run of the gate mutation audit stopped at its first mutant: "the working tree's status changed during the run".

**Why.** The log entries were written into `docs/log/` while it ran; the audit's guard compares the working tree's status before and after every mutant, and the convention says nothing else may be edited in the checkout meanwhile.

**Result.** The entries were committed and the audit rerun on a clean tree: 32 of 34 killed, the same survivors as the committed row.

**Consequence.** Nothing in the change; no edit while the audit runs.

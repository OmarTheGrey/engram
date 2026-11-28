---
date: 2026-11-28
author: claude-agent
type: change
card: none
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/configs/results-register.json
  - research/scripts/results_register.py
  - docs/research/results.md
  - docs/log/2026-11-28-rr-milestone-all-rows-reproduce.md
supersedes: none
---

**What.** The review fix pass on the results-register branch, after merging origin/main with the roadmap PR #128.

**Why.** The branch's independent review asked for it before merge.

**Result.** Before, then after: H1's needs named only the label audit; now also the smoke and B1 checks, the spend cap or credit check and the Zenodo deposit. H2 omitted C1; now it is named, and only GateMem's medium cells are shared with H1. 0.000031 rendered as 3.1e-05; now positional. The Holm levels show their thresholds. MEM-INV-Bench admission and C4's walk are reach measurements, not support artefacts. The branch's own unmerged entries were edited: the milestone names the orchestrator's run at 42131029 and engineering checks, perf-budget cites the superseded entry for load, and the audit says stale M1.

**Consequence.** The drafts and the register were rebuilt.

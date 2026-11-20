---
date: 2026-11-20
author: claude-agent
type: decision
card: RV8
chapter: evaluation
pillar: research
hypothesis: H4
evidence:
  - research/configs/cost-table.json
supersedes: none
---

**What.** The decisions of 20 November are config values (`decisions.exclude`), applied to the table as a separate `decided` block beside the registered totals, not by editing the runs.

**Why.** The registered design stays priced, so the lead sees what each decision saves; H4 runs on GateMem only (item 24), the store family is dropped (item 20), C7 is dropped (item 25).

**Result.** Thirteen rows go: all seven MemoryAgentBench arms, H4's files and letta store arms with their judges, and H4's C7 arm. H4's model arms (M2, M3), the C2 arm and the mem0 arm stay. Items 2a and 47c are the kept options.

**Consequence.** If the lead keeps the store arms for a different reason, remove the exclusion; nothing else moves.

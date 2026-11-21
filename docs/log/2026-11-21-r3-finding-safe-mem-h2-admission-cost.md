---
date: 2026-11-21
author: claude-agent
type: finding
card: R3
chapter: discussion
pillar: research
hypothesis: H2
evidence:
  - docs/research/positioning.md
  - https://arxiv.org/abs/2610.22959
supersedes: none
---

**What.** SAFE-Mem's recall above no defence does not show governance without a tax; its own ablation shows admission costs accuracy against the same memory without it.

**Why.** The November literature note read SAFE-Mem as weakening any statement that governance has an unavoidable tax (`docs/readings/litreview/2610.22959-safe-mem.md`, risk section).

**Result.** Against no defence, SAFE-Mem raises LoCoMo accuracy by 11.1 and 15.1 points on the two GPT models (Table 1). Against its own graph with every turn treated as the principal's, so that admission withholds nothing, it loses 3.6 points on GPT-5.6-terra (64.9 to 61.3) and 3.8 on GPT-4o-mini (58.4 to 54.6) (Appendix G). On MPBench, admission raises recall over governance off, 76.7 to 85.9 percent on GPT-4o-mini (Table 6), through endorsed passages.

**Consequence.** H2's contrast, C2 against C5 on the same memory, is the governance-off comparison. H2's discussion cites both rows and says which baseline each is.

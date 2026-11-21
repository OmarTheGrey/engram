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
supersedes: docs/log/2026-11-21-r3-finding-safe-mem-h2-admission-cost.md
---

**What.** SAFE-Mem's recall above no defence does not show governance without a tax: against the same memory without admission, admission costs on a benign benchmark and gains under attack.

**Why.** The November note read SAFE-Mem as weakening any claim of a governance tax.

**Result.** Against no defence, LoCoMo accuracy rises 11.1 and 15.1 points on the two GPT models (Table 1). Against its own graph with every turn treated as the principal's, so that admission withholds nothing, it loses 3.6 points on GPT-5.6-terra (64.9 to 61.3) and 3.8 on GPT-4o-mini (58.4 to 54.6) (Appendix G), while MPBench recall rises from 76.7 to 85.9 percent on GPT-4o-mini (Table 6).

**Consequence.** H2's contrast, C2 against C5 on the same memory, is the governance-off comparison; H2's discussion cites both rows and names each baseline. Supersedes the first version, whose "through endorsed passages" was an inference, not the paper's statement (review finding R3-2).

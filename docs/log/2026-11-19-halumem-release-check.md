---
date: 2026-11-19
author: claude-agent
type: finding
card: B8
chapter: related-work
pillar: research
hypothesis: H3
evidence:
  - "gh api repos/MemTensor/HaluMem"
  - "gh api repos/MemTensor/HaluMem/contents/LICENSE.txt"
  - packages/bench/PINS.md
  - docs/readings/litreview/2511.03506-halumem.md
supersedes: none
---

**What.** HaluMem's release was checked on 2026-11-19 through `gh api`, the Hugging Face API and arXiv (2511.03506, v3).

**Why.** The lead chose to register it for H3; a pin needs its commit, licence, data, judge and plug-in point.

**Result.** https://github.com/MemTensor/HaluMem: head of `main` `d653749586bfc7d13f5b68e8851f52155b5b1650` (2026-10-28, rechecked with `gh api`), no tags or releases; `LICENSE.txt` is CC-BY-NC-ND-4.0 for the whole repository, code included. Data: Hugging Face `IAAR-Shanghai/HaluMem` at `cb04336aa1b732d4b24f5186c552456b4099806e`, card licence cc-by-nc-nd-4.0; Medium (33,511,525 bytes) holds 20 users, 1,387 sessions, 14,948 memory points (3,122 updates) and 3,467 questions; Long is 106,535,674 bytes. The judge is model-based, `gpt-4o` at temperature 0 by default, no dated snapshot. Each system plugs in as `eval/eval_<system>.py`, scored by `eval/evaluation.py`.

**Consequence.** NoDerivatives forbids the committed adapted fixture subset and ported judge every pinned benchmark here has; NonCommercial conflicts with Apache-2.0 (ADR 0020).

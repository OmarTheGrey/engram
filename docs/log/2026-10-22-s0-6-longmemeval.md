---
date: 2026-10-22
author: omar
type: finding
card: S0.6
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/PINS.md
  - https://github.com/xiaowu0162/LongMemEval
supersedes: none
---

**What.** LongMemEval (arXiv 2410.10813, ICLR 2025) is released: xiaowu0162/LongMemEval at 9e0b455 (MIT) with the cleaned data on Hugging Face at revision 98d7416.

**Why.** The recall and knowledge-update arm of ADR 0015 needs a pinned revision.

**Result.** Judge is `gpt-4o-2024-08-06` at temperature 0; plug-in is a predictions file. Results on the 2025 cleaned files are not comparable with the 2024 originals.

**Consequence.** The cleaned revision is pinned; the 2.7 GB M split is out of the fixture subset.

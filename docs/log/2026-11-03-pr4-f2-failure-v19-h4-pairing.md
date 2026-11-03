---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/analysis/equivalence.py
  - research/tests/test_equivalence.py
supersedes: none
---

**What.** `equivalence.py`'s docstring said H4's items are paired by `paired_item_differences`, which keeps an item that lost a seed; decision sheet 13h takes such items out of H4's test (V-19).

**Why.** The docstring was written before 13h, and no function H4 will use drops those items.

**Result.** `complete_item_differences` keeps only items both arms kept on every seed and returns the rest; the docstring says H4's table code uses it (`2026-11-03-pr4-f2-h4-pairing`).

**Consequence.** A recommendation that changes analysis is carried into the analysis code before the tag.

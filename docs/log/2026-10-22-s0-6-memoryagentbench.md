---
date: 2026-10-22
author: omar
type: finding
card: S0.6
chapter: evaluation
pillar: research
hypothesis: H4
evidence:
  - packages/bench/PINS.md
  - https://github.com/HUST-AI-HYZ/MemoryAgentBench
supersedes: none
---

**What.** MemoryAgentBench (arXiv 2507.05257, ICLR 2026) is released: HUST-AI-HYZ/MemoryAgentBench at 5380260 (MIT) with Parquet data on Hugging Face at revision 7ea0669.

**Why.** The competencies arm of ADR 0015 needs a pinned revision.

**Result.** Scoring is mostly exact match; two subsets use GPT-4o. The fourth competency is called selective forgetting in the paper and Conflict Resolution in the code and data.

**Consequence.** Plug-in is a branch in `agent.py` plus a method module; source datasets keep their own licences, which the label audit must check.

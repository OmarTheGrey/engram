---
id: useful-memories-faulty-neurips2026
title: "Useful Memories Become Faulty When Continuously Updated by LLMs"
authors: Dylan Zhang, Yanshan Lin, Zhengkun Wu, Yihang Sun, Bingxuan Li, Dianqi Li, Hao Peng
venue: NeurIPS 2026 workshop poster (The Agentic Web)
year: 2026
tier: new
topics: [consolidation, risk, evaluation]
engram: [govern, distill, plane]
code: not listed on the page; no arXiv id on the page
sources_read: [https://neurips.cc/virtual/2026/174843]
---

## Claim
LLM-rewritten consolidated memories are often faulty. Utility rises, then falls, sometimes below a no-memory baseline, and keeping raw episodes with gated consolidation does better.

## Method
Consolidation of trajectories compared with an episodic-only control, and a controlled ARC-AGI Stream with RETAIN, DELETE and CONSOLIDATE actions. Abstract page only.

## Key numbers
- GPT-5.4 fails on 54 percent of ARC-AGI problems it solved without memory, even when consolidating from ground-truth solutions (abstract).
- Raw-by-default agents double the accuracy of forced-consolidation agents (abstract).

## What Engram borrows
A rule for the consolidation job: a summary never retires its sources by itself. It is a candidate that is linted (unsupported-claim) before it is active.

## What Engram does differently
Engram's lifecycle (candidate, active, retired; ADR 0011) is the explicit gate the paper recommends.

## Risk to our claims
This is evidence against shipping consolidation as a default. It must be off by default and measured.

## Open question
Can an unsupported-claim lint on each summary catch the faults the paper observed?

## Notes
Workshop paper, preliminary.

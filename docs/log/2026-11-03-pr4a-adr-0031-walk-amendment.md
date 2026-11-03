---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
  - research/results/h1-c4-walk.json
supersedes: none
---

**What.** ADR 0031's decision 4 and its consequences now say the walk moved the retrieval difference from C4 against C5 to C3 against C4, with the walk's counts cited from the rule-9 result.

**Why.** The plan's PR 4 asks for it, after the PR 3 verifier's N-1: the ADR described the walk's gain for C4 minus C5 but not what it moved.

**Result.** Decision 4 gains a paragraph "What the walk moved" with the counts of `research/results/h1-c4-walk.json` and a pointer to `research/results/h1-c4-verdict-agreement.json`; the consequences gain a bullet saying no H1 contrast compares C3 with C4. Before: neither text named C3 against C4. The status line records the amendment; the ADR stays proposed.

**Consequence.** The lead reads the counts beside the walk's alternatives when deciding ADR 0031.

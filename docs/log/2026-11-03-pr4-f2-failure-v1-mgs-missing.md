---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_h1_secondary.py
  - research/tests/test_h1_pipeline.py
supersedes: none
---

**What.** The verifiers found that v1 promises GateMem's MGS as a secondary outcome, but the H1 table never computed it, and the converter dropped the utility sessions it needs (V-1).

**Why.** Part A built the table around the violation rates and treated utility checkpoints as having no H1 outcome, without checking v1's list of secondary outcomes.

**Result.** The converter now keeps utility sessions and the table gives `mgs` per condition (`2026-11-03-pr4-f2-mgs`).

**Consequence.** A promise in the protocol is checked against the table's output keys before review.

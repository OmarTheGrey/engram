---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-mem-inv-admission.json
supersedes: docs/log/2026-11-03-pr4b-decision-poisoning-preset.md
---

**What.** Recommended, for the lead's decision: medium on MEM-INV-Bench, the arm kept in H1's decision as a check that can only contradict (decision sheet item 11), weighed again.

**Why.** the final verification of PR #27 (V-7): under medium C5 admits every entry, so its read is C2's plus the plane's tag; the sheet underweighed what that leaves.

**Result.** C4 minus C5 there compares channel and provenance labels with the plane's tag, presentation rather than enforcement (`research/results/h1-mem-inv-admission.json`). The check stays because a C5 clearly worse than C4 on poisoning is a result H1's claim should answer to; the arm never supports H1.

**Consequence.** Added alternative: under medium the arm is descriptive and out of the decision, which needs `research/scripts/h1_table.py` to read one more config field.

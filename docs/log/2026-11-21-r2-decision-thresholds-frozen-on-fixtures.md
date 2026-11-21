---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: H3
evidence:
  - docs/research/preregistration.md
  - docs/tasks/L7.md
  - docs/tasks/L5.md
supersedes: none
---

**What.** The NLI tier's two thresholds (P3) and the near-duplicate threshold (P4) are set on fixture sets and frozen in each arm's config before the full fault set or LongMemEval's memory is scored. They are never tuned on the data the arm reports.

**Why.** Neither card says where its thresholds come from. A threshold tuned on the reported set makes its precision and recall optimistic, which is the exploratory number the proposals exist to avoid.

**Result.** P3 uses card L3's model fault fixtures (`fixtures/faults/model`), and P4 uses the fault catalogue (`fixtures/faults/`).

**Consequence.** Cards L7 and L5 report their thresholds in the config before the run. If the fixtures are too small to set a threshold well, that is a finding for the lead before registration, not a reason to tune on the full set.

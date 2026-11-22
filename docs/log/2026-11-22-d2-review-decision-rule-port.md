---
date: 2026-11-22
author: claude-agent
type: decision
card: D2
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - packages/core/src/distill/induce.ts
  - docs/research/preregistration.md
  - docs/tasks/D2.md
supersedes: docs/log/2026-11-22-d2-decision-rule-port.md
---

**What.** The rule-based port stands as the superseded entry describes, with one consequence it did not state. Grouping by instruction text means the template step removes almost nothing: 10 of 10 examples survive it on the fixture, and on tau2, where each task has its own instruction, every task would.

**Why.** Review finding D2-12. Upstream groups by WebArena's `intent_template_id`, which many tasks share. A pi session carries no template id, so the exact instruction stands in for one.

**Result.** On the fixture the control keeps 10 trajectories from 10 examples. Only the abstract-trajectory step could remove a session there. Card D2's step 3 now carries a dated note pointing here.

**Consequence.** A template id a harness records (for example tau2's task family) would make the step do upstream's work. Pre-registration proposal P6 would need to name it before any run.

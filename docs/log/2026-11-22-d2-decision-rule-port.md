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
  - packages/core/test/unit/distill/induce.test.ts
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-21-d2-decision-rule-control.md
---

**What.** The control is now a faithful port of AWM's `webarena/induce_rule.py` at `8c0ff8cd`, fixture-only, proposed as P6 in the pre-registration's unregistered section. Mappings: a success is an example with verdict `success`; the template is the instruction, whitespace collapsed; the abstract trajectory is each call's tool plus its first argument's value; the first of each group is kept, not a random one; an invalid step is a failed or withdrawn call; manual inspection is skipped, as `--auto` does.

**Why.** Review finding D2-2: the earlier control, the most frequent run of tool calls, was a method nobody published. The lead asked for the published one, proposed and unregistered.

**Result.** Each kept trajectory is one candidate, titled by its instruction and named as its own lineage (finding D2-9). On the fixture: 10 templates, 10 trajectories, 10 candidates.

**Consequence.** Card D3's cassettes key on skill names, so D3 must re-record.

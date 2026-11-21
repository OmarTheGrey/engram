---
date: 2026-11-21
author: claude-agent
type: finding
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/absorb/00-master-plan.md
  - docs/research/baselines.md
supersedes: none
---

**What.** The master plan's labels for the baseline decisions are ambiguous. "D13" names two different questions, and "D14" is the decay default, not the rule that keeps Mem0 and Letta as the only wrapped stores.

**Why.** Card R2's brief cites "decision D14" for the wrapped-store rule, and `docs/research/baselines.md` needs to cite its basis correctly.

**Result.** In `00-master-plan.md`, D13 first asks about self-approval, under the approval-workflow addendum. The baselines addendum then reuses D13 for "baselines are labelled algorithm re-implementation" and uses D14 for "decay default is demote-only". The wrapped-store rule is the gap study's finding (AB-GAP4-1). `baselines.md` cites the addendum and the study, and no D number.

**Consequence.** The lead's confirmation of the labelling rule should name it by its text, not by a D number.

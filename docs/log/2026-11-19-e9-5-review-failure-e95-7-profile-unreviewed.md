---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - packages/pi-package/profiles/twin.yaml
  - docs/dogfood.md
supersedes: none
---

**What.** Review finding E95-7 (important): the twin profile's values were never reviewed, though the profile says they are proposed until reviewed for this dogfood.

**Why.** The first pass read the profile only for its rules, not its numbers.

**Result.** `docs/dogfood.md` has a section reviewing each value against ADRs 0021, 0004, 0025 and 0026, the medium preset and two weeks of use, with a recommendation per value; the profile is unchanged.

**Consequence.** The lead's acceptance is precondition 3 of the start.

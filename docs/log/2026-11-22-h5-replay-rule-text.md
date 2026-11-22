---
date: 2026-11-22
author: claude-orchestrator
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/lead-decisions.md
  - docs/decisions/0045-replay-validation-source.md
supersedes: none
---

**What.** H5's registered stopping rule now states the replay admission rule exactly: 5 held-out tasks drawn by the config's seed from the procedure's split, each replayed with and without it on seeds 1 to 3. A task passes at a mean reward of at least 2/3 that is not below its mean without the procedure. Admission is at 4 of 5.

**Why.** The lead fixed this reading of "4 of 5 runs" on 2026-11-22 (lead-decisions item 63), when card D3's review showed the bare phrase allowed a harmful procedure in. He then asked for the registered text to say it before the tag.

**Result.** One sentence of H5's stopping rule changes, and the version table gains a row. No other registered value moves.

**Consequence.** The pre-registration alone now gives the rule the plane enforces. This must merge after card D3, which adds item 63 and ADR 0045.

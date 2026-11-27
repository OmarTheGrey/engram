---
date: 2026-11-26
author: claude-agent
type: finding
card: X21
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/preregistration.md
  - packages/runner/src/gatemem-probe.ts
supersedes: none
---

**What.** Two things for the lead and card X20, neither changed here.

**Why.** The pre-registration's Statistics section ("Seeds and exclusions") says the H1 table "does not count capped utility sessions"; with this card merged that half is built. It is registered text, which this card may not edit, so the answers card or the tag's preparation should update it with X20's half. Second, the converter marks `capped` only for the probe's `excluded: "turn limit"`. Card X20 adds a second exclusion reason for a refused answer call; a refused utility session would then still reach the table as a null `utility_ok`, uncounted, the gap this card closed for the cap.

**Result.** No registered text, config or result moved.

**Consequence.** Whoever merges second of X20 and X21 checks whether a refused utility session needs its own count; the pre-registration's "not built yet" sentence is updated before the tag.

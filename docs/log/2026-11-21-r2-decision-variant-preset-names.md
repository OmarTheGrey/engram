---
date: 2026-11-21
author: claude-agent
type: decision
card: R2
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/research/preregistration.md
  - docs/decisions/0017-cached-metered-seeded-model-calls.md
supersedes: none
---

**What.** In every proposal, a variant of a registered condition (for example C5 with the injection screen on) runs under a preset of its own name, such as `medium+screen-default`.

**Why.** ADR 0017's cache key includes the preset. A variant that reused `medium` would share cache keys with a registered cell, and a replay could serve the registered cell's call for a different policy.

**Result.** The section's head states the rule. P7 follows from it: the trust preset cannot be compared by replaying H1's cassettes, so it compares the recorded decisions instead.

**Consequence.** Each arm's card names its preset. If wrong, variants would need a separate cache field, which is a runner change.

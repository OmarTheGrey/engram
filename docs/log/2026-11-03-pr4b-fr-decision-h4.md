---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H4
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h4-power.json
  - packages/runner/src/stores.ts
supersedes: docs/log/2026-11-03-pr4b-decision-h4.md
---

**What.** Recommended, for the lead's decision: H4 at 5 points with 761 items per arm (decision sheet item 12), with what is not yet fixed now stated.

**Why.** the final verification of PR #27 (V-13, and H4's stores): v1 omitted the caveat below 761 items, how the items are drawn, and that the runner has no files store.

**Result.** Below 761 items the level search found the test above 0.01 (640 fails); the seeded rule drawing the 761 items is fixed before H4 runs, in card X9; the runner's stores are fake, Mem0 and Letta, so the files store joins before H4.

**Consequence.** Card X9's status lists these steps.

---
date: 2026-11-25
author: claude-agent
type: decision
card: L10
chapter: design
pillar: research
hypothesis: H3
evidence:
  - docs/tasks/L10.md
  - docs/decisions/0008-two-tier-lints.md
  - research/results/MANIFEST.md
supersedes: none
---

**What.** Card L10, the contradiction prompt's change (item 44), lands in W11, after H1's `MERGE=4`, not before the tag.

**Why.** It edits `packages/core` and moves registered results (`h3-lint-floor.json`, `h2-cost-table.json`) and three cassette folders; the second plan resumes core changes and moved rows only after `MERGE=4`. H1 runs C2 to C5, which run no lint, so H1 is unaffected, and ADR 0008's amendment already records the change as owed, so the tagged text is honest about it. Landing it before the tag would spend review time the four pre-tag cards need.

**Result.** L10 must merge before card L3's live pilot and H3's model run (card X10, W17), both of which send the prompt.

**Consequence.** If the lead wants the tagged code to hold the new prompt, L10 moves to W8 and competes with R5, R6, X20 and X21.

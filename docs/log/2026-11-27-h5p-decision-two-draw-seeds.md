---
date: 2026-11-27
author: claude-agent
type: decision
card: H5P
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/H5P.md
supersedes: none
---

**What.** Proposed for the lead: two seeds: `split_seed` 20261125 for the halves and a separate `draw_seed` 20261126 for the replay's 5-task draw of ADR 0046.

**Why.** The first draft named one `draw_seed` for both draws (review finding F12). With one generator a change to the halves would move every replay draw, and the order of the draws would need fixing.

**Result.** Each draw has its own seed in the config, and neither moves when the other changes. Card H5P row 1.

**Consequence.** The lead's answer entry on this item supersedes this one; nothing is registered until then.

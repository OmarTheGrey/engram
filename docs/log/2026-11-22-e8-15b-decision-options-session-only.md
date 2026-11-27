---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15b
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/workspace.ts
  - packages/cli/test/tui/review.test.ts
supersedes: none
---

**What.** `--ascii`, `--high-contrast`, `--reduced-motion` and `--no-mouse` hold for their session only; only the workspace panel's toggles for those options write them to tui.json, for the next start.

**Why.** The lead's decision on review M11: one `--high-contrast` and an apply made it permanent, with no flag to undo it.

**Result.** review.test.ts: after a session with both flags, saving writes no option; the panel's toggle writes `contrast: high`.

**Consequence.** The toggles take effect on the next start, which the panel says.

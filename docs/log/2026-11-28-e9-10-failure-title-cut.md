---
date: 2026-11-28
author: claude-agent
type: failure
card: E9.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/__frames__/help-120x40-default.txt
supersedes: none
---

**What.** The first title, `Harness memory outside the plane`, was cut to `Harness memory outside the plan` in the help overlay at 120x40 and widened the palette's title column, moving every palette row.

**Why.** The overlays size their column to the longest title.

**Result.** The title became `Harness memory`; the regenerated goldens differ from main's only by the new row.

**Consequence.** None.

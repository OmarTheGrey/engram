---
date: 2026-11-23
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/theme.ts
  - packages/cli/test/tui/__frames__/form-80x24-ascii.txt
supersedes: none
---

**What.** Under `--ascii` (and conhost's ASCII symbols) a closed fold draws `+` instead of `>`, so it is never taken for the `>` that marks the selection; the open fold stays `v`.

**Why.** The review's UX item. 11.7's ASCII set lists `>` for a closed fold; `+` is the common collapsed-tree mark, and the allow symbol `+` is always followed by its word.

**Result.** The ASCII frame snapshots that show a closed fold were regenerated, E8.15b's among them.

**Consequence.** If the lead prefers another mark, it is one line in theme.ts and the ASCII snapshots.

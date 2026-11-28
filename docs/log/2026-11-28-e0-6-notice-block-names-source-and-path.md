---
date: 2026-11-28
author: claude-agent
type: decision
card: E0.6
chapter: design
pillar: research
hypothesis: none
evidence:
  - scripts/check-absorbed.ts
  - NOTICE
supersedes: none
---

**What.** A copy's NOTICE entry counts only when one block of `NOTICE` (text between rule lines of dashes) names both the row's source repository (`owner/repo`, case folded) and one of its landed paths.

**Why.** The card asks for an entry naming the source. The source alone would pass a second copy from a project already in NOTICE for another file (Remnic and Claude-Mem each appear twice), so the notice for the new file could be missing unnoticed. Every current NOTICE block already names its files.

**Result.** All twelve copy rows of main's register pass; the red row whose source is named only beside another file fails.

**Consequence.** A card copying from a project already in NOTICE names its own file in that block or adds one. A NOTICE reorganised without file names would fail, by design.

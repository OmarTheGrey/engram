---
date: 2026-11-28
author: claude-agent
type: finding
card: E9.10
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/discover.ts
supersedes: none
---

**What.** The location table's rows were written on 2026-11-28 from the vendors' documentation as known to the implementing agent; the linked pages were not fetched in this session, since the brief allows network only for pinned upstream data.

**Why.** The card's risk is that vendors move paths; the table is dated data so that a check can correct it.

**Result.** Ten rows are marked documented; `codex/memories` (`~/.codex/memories/`) is marked unverified. Claude Code's auto memory path matches this machine's own (`~/.claude/projects/<project>/memory/MEMORY.md`).

**Consequence.** For the lead: open the four links and confirm or correct the rows and the date before the thesis cites the table.

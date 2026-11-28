---
date: 2026-11-28
author: claude-agent
type: change
card: E9.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/discover.ts
  - packages/cli/test/doctor-discover.test.ts
supersedes: none
---

**What.** The walk lstats every start folder and every file it takes, follows no link anywhere, and counts a link at a harness location, or a linked folder it would have entered, as `linked`; the report and doctor's line say the counts are then a floor, and doctor warns on a link alone.

**Why.** The review reproduced a junction at `~/.claude/rules` being followed, and links met in the walk dropped silently, while Claude Code's docs say its rules folder supports links.

**Result.** A test with four junctions (and a file link where the platform allows one) counts them as linked and walks none. Mutations killed: following a start link, and not counting links met in the walk.

**Consequence.** A store root reached through a link still compares lexically: such memory counts as outside.

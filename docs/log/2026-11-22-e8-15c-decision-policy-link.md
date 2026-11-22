---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/events.ts
supersedes: none
---

**What.** "open the rule in Policy" opens the Policy screen with the policy id the check returned shown verbatim ("opened from a decision: policy id ..."), the tree folded; nothing is unfolded or searched from the id.

**Why.** 8.7 says the link reads nothing into the id. Finding "that rule" in the tree would mean parsing the id's segments against the policy's shape, which is reading into it; 8.18's "jumps here with that rule unfolded" is the part not done.

**Result.** The person sees the id and can find it with `/`.

**Consequence.** If the plane ever returns a rule's path with its decision, the screen can unfold it without reading the id.

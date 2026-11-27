---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/flows.test.ts
supersedes: none
---

**What.** Several edits went wrong on the way: Bash heredocs ate backslashes in a regular expression, Python replacements missed text biome had reformatted, and pseudoconsole scripts typed a palette query into a field.

**Why.** The brief's known pitfalls; each was seen in the next run.

**Result.** Fixed by writing edit scripts to files and rereading formatted text; the scripts were corrected and rerun. Nothing reached a commit broken.

**Consequence.** None.

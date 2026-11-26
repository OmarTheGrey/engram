---
date: 2026-11-23
author: claude-agent
type: failure
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/src/tui/screens/grants.ts
supersedes: none
---

**What.** A mutation run restored its file with `git checkout`, which also discarded the uncommitted Grants rewrite in that file.

**Why.** The mutation script restores from the index; the rewrite was not committed yet, so the restore took it back to the last commit.

**Result.** Seen at once (git status showed only the tests changed); the rewrite was applied again from its script and committed before any further mutation.

**Consequence.** Commit before every mutation run.

---
date: 2026-11-28
author: claude-agent
type: decision
card: X16
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/scripts/gate_mutation_audit.py
supersedes: none
---

**What.** The scratch copy holds the tracked files in a temporary folder outside the repository, and gets its dependencies by directory links (junctions on Windows) to the installed packages; a link to one of the workspace's own packages points at the copy's, so the copy's packages import each other's mutated source.

**Why.** A `pnpm install` in the copy may run install scripts that reach the network (better-sqlite3's prebuilt binary); links need nothing beyond the installed tree. Links are removed one by one before the folder is deleted, so no delete follows a link into the real `node_modules`.

**Result.** The copy builds in about three seconds with 118 links, and the tree's status was unchanged after the runs.

**Consequence.** The audit needs `pnpm install` done in the checkout it runs from. If wrong (a package resolved outside the links), a mutant would not load and the run stops as could-not-tell.

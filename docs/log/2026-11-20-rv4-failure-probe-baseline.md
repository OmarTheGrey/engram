---
date: 2026-11-20
author: claude-agent
type: failure
card: RV4
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/rv4-files.test.ts
supersedes: none
---

**What.** Two probe runs misled on the way: the reviewer's forge probe as written showed no leak on branch rv4, and the first "main" baseline ran branch rv4's code.

**Why.** The probe names its forged file `forged.md`, which card RV3's name tie already refuses; RV-ADP-4 needs the file named by its own new id. The baseline used `git stash`, which held only an uncommitted test edit, not the committed fix.

**Result.** With the file named `<id>.md`, and core checked out at `00c606e`, Mallory read the PIN hint; on branch rv4 she reads nothing. The test reproduces the id-named variant.

**Consequence.** None for the code.

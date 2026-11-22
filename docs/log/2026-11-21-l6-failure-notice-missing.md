---
date: 2026-11-21
author: claude-agent
type: failure
card: L6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - NOTICE
  - docs/absorbed.md
supersedes: none
---

**What.** The core commit's header in supersede.ts said Remnic's notice was in NOTICE, but the commit did not add one, nor any docs/absorbed.md row.

**Why.** Rule 16 requires both in the same pull request.

**Result.** Commit 9e089a33 touched neither file. Both were added on this branch.

**Consequence.** None.

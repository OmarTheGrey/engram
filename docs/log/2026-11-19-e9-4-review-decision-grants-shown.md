---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/ui/src/view.ts
  - packages/ui/test/twin.test.ts
  - test/e2e/twin.e2e.test.ts
supersedes: none
---

**What.** The inspector shows a viewer who is not an item's owner only the grants whose `to` names it, exactly or by a prefix ending in `*`, with a line saying its owner sees all of them.

**Why.** Review finding M2. Matching a pattern here only decides what is displayed, not what is read; the plane still decides access.

**Result.** Tested in `packages/ui/test/twin.test.ts` (owner sees two grants, grantee one; a covering pattern counts) and in Chromium; a mutant showing all grants fails both unit tests.

**Consequence.** None.

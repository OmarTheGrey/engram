---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.4
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - test/e2e/twin.e2e.test.ts
  - packages/ui/test/twin.test.ts
supersedes: none
---

**What.** Review finding M4 of PR #44: no test asserted that a denied change leaves the grants the editor lists unchanged.

**Why.** The tests checked the deny event and its rule, not the list after it.

**Result.** The Chromium test and `packages/ui/test/twin.test.ts` now compare the listed grants before and after four refusals.

**Consequence.** None.

---
date: 2026-11-22
author: claude-agent
type: failure
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/keys.test.ts
  - packages/cli/test/tui/review.test.ts
supersedes: none
---

**What.** The first pass of the screens failed 30 of E8.15b's tests.

**Why.** They reached the generated form by Write, Read, Promote and Policy; the new screens differ in kind, keep their result on the same screen, and a field kept focus after a run, so `c` typed instead of copying.

**Result.** After a run focus now leaves the field for the result; Read's esc goes back to the query; Write's hints were shortened so `alt+p` stays in an 80-column row; the wheel reaches the new screens. The remaining failures were kinds and snapshots (decision-e8-15b-tests).

**Consequence.** None.

---
date: 2026-11-22
author: claude-agent
type: decision
card: E8.15c
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/cli/test/tui/keys.test.ts
  - packages/cli/test/tui/review.test.ts
  - packages/cli/test/tui/frames.test.ts
supersedes: none
---

**What.** E8.15b's tests that reached the generated form through read, write, promote and policy now name the new screens' kinds (12 assertions); frames.test's `form` snapshot draws the generated form on Check a write instead of Write, and the `confirm` snapshots show Write's own screen behind the dialog (16 snapshot files regenerated).

**Why.** The card gives these commands screens of their own, so the old kinds no longer hold; the generated form keeps its snapshot on a command that has no screen of its own.

**Result.** Nothing else in those tests changed. Read's esc goes back from the lanes to the query, as from a result to the form.

**Consequence.** If the lead prefers the old snapshots untouched, frames.test can name a second form screen; the assertions must change either way.

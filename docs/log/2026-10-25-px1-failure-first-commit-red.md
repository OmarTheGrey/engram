---
date: 2026-10-25
author: claude-agent
type: failure
card: PX1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/pi-extension/test/interception.test.ts
  - "git checkout 951850c && pnpm --filter pi-extension exec vitest run"
supersedes: none
---

**What.** The first PX1 commit (951850c, rebased as 9ec5760) fails its own tests.

**Why.** It changed the S0.5 interception script and the extension, while the golden session fixtures were regenerated only in the next commit, by design ("fixtures in their own commit"). Review finding R7-14 inferred this; the review fix pass checked it.

**Result.** At 951850c the pi-extension package runs 36 tests: 34 pass and the 2 golden-file tests fail (the expected file and the session fixture). At the rebased 9ec5760 6 fail, the other 4 from PR #5's changed APIs. History is not rewritten, so a bisect over PX1 meets a red commit.

**Consequence.** A change that alters a golden file regenerates it in the same commit, or the commit message names the commit that does.

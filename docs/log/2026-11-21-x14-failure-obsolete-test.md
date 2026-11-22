---
date: 2026-11-21
author: claude-agent
type: failure
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/test/redteam/settings.test.ts
supersedes: none
---

**What.** The settings test that a not yet enforced guard is refused became untestable once card E2.11 merged.

**Why.** No option of either block remains unenforced, so no input exercises that refusal.

**Result.** The test now checks that a value core does not know is refused by the loader, and a second that the trust variant changes only its block.

**Consequence.** None.

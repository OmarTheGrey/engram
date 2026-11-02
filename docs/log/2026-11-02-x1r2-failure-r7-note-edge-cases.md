---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/x1-mem-inv.test.ts
supersedes: none
---

**What.** The note kept surrounding whitespace, treated a whitespace-only reply as a note, and failed the run on a failed call, where upstream strips, falls back and goes on.

**Why.** Only upstream's `build_memory` was read, not its driver.

**Result.** Matched and tested.

**Consequence.** Found by the second review of PR #25 and fixed in its round-2 fix pass.

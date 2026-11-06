---
date: 2026-11-06
author: claude-agent
type: failure
card: E8.9
chapter: limitations
pillar: research
hypothesis: none
evidence:
  - packages/runner/test/b3.test.ts
  - "pnpm --filter runner exec vitest run test/b3.test.ts"
supersedes: none
---

**What.** In one full parallel `vitest run` on the Windows build machine, card B3's runner acceptance ("offline, the committed cassettes answer every call; each probe logs its writes and its read") failed on branch `e8-9-simulator`, which changes no runner code.

**Why.** Most likely its last check: it lists the folders with the Letta store prefix in the system temp directory before and after its run and expects no new one, so any other test making such a folder at the same moment fails it.

**Result.** Run alone twice on the same branch, the file passes 9 of 9; the earlier full runs of this branch passed it.

**Consequence.** Quarantine it with an issue (testing convention); the fix is to give the runner a temp root of its own per test instead of comparing the shared one.

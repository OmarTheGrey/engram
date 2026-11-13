---
date: 2026-11-06
author: claude-agent
type: failure
card: PX2
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/repository.test.ts
  - "pnpm --filter adapters exec vitest run test/letta/repository.test.ts"
supersedes: none
---

**What.** In one full parallel `vitest run` on the Windows build machine, the Letta test "four openers race to initialise it; every one opens and every write lands" (review M-2) failed.

**Why.** Unknown; the test races four git initialisations of one folder, and the run had every package's tests in parallel. PX2 changes no adapter code.

**Result.** Run alone three times, the file passes 34 of 34 each time; the earlier full runs on branches `e8-9-simulator` and `schema-v1` passed it.

**Consequence.** The testing convention asks for quarantine with an issue link the same day; the lead opens the issue, since this machine has no GitHub CLI.

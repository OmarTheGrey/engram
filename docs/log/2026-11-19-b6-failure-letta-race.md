---
date: 2026-11-19
author: claude-agent
type: failure
card: B6
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/adapters/test/letta/repository.test.ts
  - docs/log/2026-11-06-px2-failure-letta-race-under-load.md
  - "pnpm exec vitest run packages/adapters/test/letta/repository.test.ts"
supersedes: none
---

**What.** The second full `make test` on this branch failed on one test only, the Letta adapter's "four openers race to initialise it; every one opens and every write lands" (review M-2), with a lock held and a folder busy (EBUSY).

**Why.** The flake card PX2 logged under a loaded parallel run; B6 changes no adapter code. The first full run had passed this file and failed only B3's timeout (`docs/log/2026-11-19-b6-failure-b3-timeout.md`).

**Result.** Run alone, the file passes 34 of 34. Across the two full runs every one of the 179 files passed at least once and 177 passed both times; pytest passed 236 tests.

**Consequence.** None for the code; the quarantine PX2 asked for is still the lead's to open.

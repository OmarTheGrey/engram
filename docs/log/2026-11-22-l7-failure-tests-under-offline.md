---
date: 2026-11-22
author: claude-agent
type: failure
card: L7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/model/test/nli.test.ts
  - packages/runner/test/lint-nli.test.ts
  - .github/workflows/ci.yml
  - "ENGRAM_OFFLINE=1 make test-one T=packages/model/test/nli.test.ts"
supersedes: none
---

**What.** Three of card L7's tests failed under `ENGRAM_OFFLINE=1`, which CI sets: two of the pinned fetch with a fake fetch, and one of recording NLI scores with a scripted scorer.

**Why.** The card's tests were only ever run with the variable unset. The offline guard in `fetchNliModel` and `cachedNli` fires before the injected fake is asked, as it should; the tests assumed it would not, the same mistake as card X14's finding X14-6.

**Result.** The guard is unchanged. Each test of the fetch or recording path clears the variable for its own call (`withOffline`) and restores it, and the guard is tested with it set: the fetch is refused without asking the fake, a cache miss is refused, and a run given a scorer records nothing and never asks it (a new runner test). Both files pass with the variable set and unset: 15 and 8 tests.

**Consequence.** Run every new test file both ways before reporting it done.

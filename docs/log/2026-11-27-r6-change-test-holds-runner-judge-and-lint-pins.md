---
date: 2026-11-27
author: claude-agent
type: change
card: R6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/test/rv6-endpoints.test.ts
  - packages/runner/src/live.ts
  - "make test-one T=packages/runner/test/rv6-endpoints.test.ts"
supersedes: none
---

**What.** Three fixes to the endpoint test. It now takes each config's judge from `judgeModel`, which `live.ts` now exports. That is how the runner resolves the judge: the config's own, or else the benchmark's paper judge. The lint configs' test now requires their pin instead of returning early. The header states the seed-first rule.

**Why.** Review findings 5, 6 and 9. A config that dropped its explicit judge and its judge pin passed while the run would call GPT-4o unpinned, and deleting the lint pins kept the test green.

**Result.** 20 of 20 pass. Mutations: removing `judge` and the judge pin from `h1-gatemem.json` fails that config's test. Removing the pin from `l3-pilot.json` fails the lint test. Both were restored from the index.

**Consequence.** The test now pins what the runner calls, not just what each config spells out.

---
date: 2026-11-21
author: claude-agent
type: failure
card: X14
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/cli/src/doctor.ts
  - fixtures/amsb/scenarios.json
  - "ENGRAM_OFFLINE=1 pnpm exec vitest run packages/cli/test/doctor.test.ts packages/cli/test/doctor-review.test.ts"
supersedes: none
---

**What.** Card X14 broke twenty tests of `engram doctor` (`packages/cli/test/doctor.test.ts` and `doctor-review.test.ts`) and its report missed it: the full `make test` was never run on the branch, only the tests of the modules it changed.

**Why.** Doctor treats every folder under `fixtures/bench/` as a vendored benchmark and fails one without a `manifest.json` against a pin ("fixtures/bench/amsb has no manifest.json"). The new PINS.md section was not the cause: doctor reads only the registered table and the candidates table.

**Result.** The corpus moved to `fixtures/amsb/`, as card B11 moved tau2's fixtures; every reference, and the unmerged log entries' evidence paths, followed. Doctor's checks are unchanged; its two test files pass, and the result's bytes did not change.

**Consequence.** A card that adds a folder outside its own package runs the test files of every module that reads that folder.

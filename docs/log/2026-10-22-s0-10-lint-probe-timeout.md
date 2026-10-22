---
date: 2026-10-22
author: omar
type: failure
card: S0.10
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - scripts/test/pi-import-rule.test.ts
  - "make test"
supersedes: none
---

**What.** The test proving the pi-import lint rule timed out in the full suite although it passed alone.

**Why.** It spawned Biome three times per package; under a parallel `make test` each spawn took about two seconds, past Vitest's 5-second default. Two earlier designs also failed: Biome 2.5 in stdin mode exits 1 for a clean file without `--write` and prints no diagnostics with it, and probe files under `.gitignore` are skipped unless `--vcs-use-ignore-file=false` is passed.

**Result.** One Biome run per package over three probe files, counting three diagnostics, with a 30-second timeout; two full runs passed 114 of 114.

**Consequence.** Tests that spawn tools set an explicit timeout.

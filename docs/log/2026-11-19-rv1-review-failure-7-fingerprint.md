---
date: 2026-11-19
author: claude-agent
type: failure
card: RV1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/runner/src/journal.ts
  - packages/runner/test/rv1-review.test.ts
  - "pnpm --filter runner exec vitest run test/rv1-review.test.ts"
supersedes: none
---

**What.** The review (RV1-7) found that the run's fingerprint left out `data` and `script`, so resuming a pipeline config after its script changed would mix two runs.

**Why.** The first pass left out every path, to let a live run and its replay share a folder; only the cassettes need that.

**Result.** The fingerprint now holds the data folder and each script (the answer script and the judge's) by path and by the sha256 of its contents; only the cassettes and the spend ceiling are left out. Test: another data folder, another script path, or the same script with other steps each give another fingerprint; another cassette folder or ceiling does not.

**Consequence.** A resume refuses a folder written with another script or data set.

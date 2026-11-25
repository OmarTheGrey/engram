---
date: 2026-11-25
author: claude-agent
type: decision
card: L8
chapter: design
pillar: plane
hypothesis: H3
evidence:
  - packages/core/test/unit/lint/near-duplicate-presets.test.ts
  - research/results/MANIFEST.md
  - packages/runner/src/lint-fault-set.ts
supersedes: none
---

**What.** Case (b): the filtered reach is the default, and core has `LintOptions.reach: "scope-registered"`. Every registered call site passes it: lint-fault-set.ts, lint-faults.ts, fault-set-check.ts, fault-set-script.ts, nli-determinism.ts and near-duplicate-pairs.ts.

**Why.** No MANIFEST row moved under the default. The script rerun printed `SAME` for h3-fault-set, h3-lint-floor, h3-near-duplicate and h3-lint-nli. But one committed pin did move: near-duplicate-presets.test.ts's hashes of the strict and medium lint reports over fixtures/faults and the L2 fixture base failed 4 of its tests. Under each of those presets 21 of the test's 34 runs changed. Under medium, 20 changed in evidence wording only, and orphan.flag.json lost a source-changed finding on a retired source. Under strict, 19 changed in wording only, and orphan.flag.json and base state dfde3500 changed their (lint, item) findings.

**Result.** With the option passed, that test, the four rows and h2-cost-table all reproduce their bytes.

**Consequence.** The research path keeps card L1's reach until the lead says otherwise.

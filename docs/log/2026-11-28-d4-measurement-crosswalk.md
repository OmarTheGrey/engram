---
date: 2026-11-28
author: claude-agent
type: measurement
card: D4
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-crosswalk.json
  - research/configs/crosswalk.json
  - research/results/MANIFEST.md
  - docs/compliance/README.md
  - packages/core/test/unit/distill/drift.test.ts
  - "uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json --table docs/compliance/README.md"
supersedes: docs/log/2026-11-28-e0-7-measurement-crosswalk-review.md
---

**What.** The unregistered `research/results/h1-crosswalk.json` row moved in card D4's PR, as the plan names: claim C48 cites four drift tests, and its untested half, a human rejection narrowing the trigger, is its own claim C51, not evidenced.

**Why.** Rule 9, and the plan's step 6. C48 as written also claimed a smoothed rate and human rejection, which D4 does not build; citing tests for the whole claim would overstate it.

**Result.** A support artefact, not a hypothesis result. The script printed "crosswalk: 51 claims, 48 evidenced by 111 tests in 34 files, 3 not evidenced, 27 obligations" (was 50, 47, 107, 33). New sha256 `43afbde19ce69560ce88c715a7654c161fcbb2025661711e8fca5bbb0aad1b74`, MANIFEST commit b316a25; a rerun gave the same bytes.

**Consequence.** The results register is regenerated from it.

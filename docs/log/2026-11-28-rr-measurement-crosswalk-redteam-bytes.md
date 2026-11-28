---
date: 2026-11-28
author: claude-agent
type: measurement
card: none
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-crosswalk.json
  - research/configs/crosswalk.json
  - research/results/h1-redteam.json
  - research/configs/redteam.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json"
  - "uv run python research/scripts/redteam.py --config research/configs/redteam.json --out research/results/h1-redteam.json"
supersedes: docs/log/2026-11-25-e9-9-measurement-registered-bytes-unchanged.md
---

**What.** Card E9.9's check that no registered byte moved, restated with each cited row's config as evidence.

**Why.** The earlier entry cited `research/results/h1-crosswalk.json` and `research/results/h1-redteam.json` without `research/configs/crosswalk.json` or `research/configs/redteam.json` as evidence items, which the thesis consolidator rejects.

**Result.** A reproduction check, not a hypothesis result. As the superseded entry records, card E9.9 regenerated h1-crosswalk, h1-injection-screen, h1-secret-guard, h1-redteam and h2-perf-budget into a scratch folder, each to the MANIFEST's sha256. On 2026-11-28 the committed crosswalk and red-team files still hash to their MANIFEST rows. The crosswalk still reads `summary.claims` 50 and `summary.evidenced` 46; the red-team table still reads `corpus.attacks` 1,278 and `corpus.controls_total` 448.

**Consequence.** Card E9.9's rule needed no amendment of the registered conditions; nothing else changes.

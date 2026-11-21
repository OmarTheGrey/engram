---
date: 2026-11-21
author: claude-agent
type: measurement
card: R4
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-crosswalk.json
  - research/configs/crosswalk.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json --legal .engram/upstream/legal"
supersedes: docs/log/2026-11-21-r4-measurement-crosswalk.md
---

**What.** The crosswalk's result after the review fix pass, regenerated from `research/configs/crosswalk.json`, MANIFEST row `research/results/h1-crosswalk.json` (commit cell beb820d, the post-rebase commit holding the script and config, until the squash merge).

**Why.** Rule 9; the fix pass changed the evidence named and the result's fields.

**Result.** The script printed "crosswalk: 27 quotes stand in the primary texts" and "crosswalk: 50 claims, 46 evidenced by 105 tests in 32 files, 4 not evidenced, 27 obligations". Not evidenced: C30, C44, C48, C50; C21 cites no obligation. The result carries `"hypothesis": "none"`. `scripts.reproduce.check_row` on the row returned no problems.

**Consequence.** `make test-repro` reruns it.

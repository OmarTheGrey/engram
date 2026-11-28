---
date: 2026-11-28
author: claude-agent
type: measurement
card: E9.16
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-crosswalk.json
  - research/configs/crosswalk.json
  - research/results/MANIFEST.md
  - docs/compliance/README.md
  - "uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json --table docs/compliance/README.md --legal .engram/upstream/legal"
supersedes: docs/log/2026-11-28-d4-measurement-crosswalk-review.md
---

**What.** The unregistered `research/results/h1-crosswalk.json` row moved in card E9.16's PR, as the plan names: seven GDPR obligations added (Articles 15(1), 15(3), 15(4), 20(1), 30(1)(c), (d), (g)) and claims C52 and C53 pointed at the new tests.

**Why.** The plan's guard for this card: GDPR Articles 15, 20 and 30 in the crosswalk.

**Result.** A support artefact, not a hypothesis result. The script printed "crosswalk: 53 claims, 50 evidenced by 117 tests in 37 files, 3 not evidenced, 34 obligations" and "34 quotes stand in the primary texts". New sha256 `a44c6c691d4fb59eafcda89e3940f719e0d653df19458554f4959ad706c28f0a`, MANIFEST commit f729d0c1; main's config still gives `8fad8887...`.

**Consequence.** The results register and page are regenerated from it.

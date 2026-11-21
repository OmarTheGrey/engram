---
date: 2026-11-21
author: claude-agent
type: measurement
card: E2.10
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-injection-screen.json
  - research/configs/injection-screen.json
  - fixtures/injection-screen/corpus.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/injection_screen.py --config research/configs/injection-screen.json --out research/results/h1-injection-screen.json"
supersedes: docs/log/2026-11-21-e2-10-corpus-result.md
---

**What.** The corpus result regenerated after the fix pass, with 21 benign controls of the review's five classes added (95 entries; MANIFEST row sha256 `3e35dd39...`, commit `69616d41`).

**Why.** Review E2.10-3: the first controls left out natural benign text the default screen holds.

**Result.** Default: 4 of 12 attacks escape (0.333, Wilson 95% [0.138, 0.609]); 11 of 68 benign controls held (0.162, [0.093, 0.267]): all 4 ML documentation, 5 CI and operations and 2 compaction controls; 0 of the user-addressed and encoding controls. Hardened: 4 escape; 13 of 68 held (0.191, [0.115, 0.300]); 11 of 15 tool-written preferences. Off holds nothing.

**Consequence.** The false-hold rate is three times the first report's upper bound; the config's limits name each class still held.

---
date: 2026-11-21
author: claude-agent
type: decision
card: R4
chapter: design
pillar: research
hypothesis: none
evidence:
  - research/tests/test_prereg.py
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The crosswalk's result is `research/results/h1-crosswalk.json`, not the card's `research/results/crosswalk.json`.

**Why.** `research/tests/test_prereg.py` requires every MANIFEST row to match exactly one hypothesis's results glob (`h1-*` to `h5-*`), and the registered sections of `docs/research/preregistration.md` may not change before the `prereg-v1` tag. H1 is the nearest owner: invariants 1 and 2, the crosswalk's first rows, are the basis of H1. The crosswalk tests no hypothesis, and its measurement entry says `hypothesis: none`. Earlier cards did the same (`cost-table.json` writes `h2-cost-table.json`).

**Result.** `test_every_manifest_result_maps_to_exactly_one_hypothesis` passes with the row.

**Consequence.** If wrong, a pre-registration amendment adds a glob for results outside the hypotheses and the file is renamed; nothing else reads the name.

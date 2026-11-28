---
date: 2026-11-28
author: claude-agent
type: finding
card: L9
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - research/configs/l3-lint-fixture.json
  - research/configs/h3-lint-model-fixture.json
  - research/configs/l3-lint-nli-fixture.json
  - research/configs/h3-lint-nli-fixture.json
supersedes: none
---

**What.** The guard reruns: every MANIFEST row and fixture run the model lints or the policy loader reach, rerun on this branch.

**Why.** The guard: the option absent must leave every registered byte as it is.

**Result.** `make run` of l3-lint-fixture (0 new, 51 cached), h3-lint-model-fixture (0 new, 250), l3-lint-nli-fixture (0 new, 9; 72 scores cached) and h3-lint-nli-fixture (0 new, 214; 452 scores): results, summary and usage byte for byte as before this card, as are `make l3-variance FIXTURE=1` and `make h3-lint-delta FIXTURE=1`. Rows through `reproduce.rerun_row`: h3-lint-nli (22e3c122...) and h3-lint-floor (354da571...) ok; h2-cedar-properties skipped, cvc5 missing. No fixture or cassette changed (`git status fixtures` shows only the new folder).

**Consequence.** h2-cedar-properties rests on the export test showing the medium export unchanged.

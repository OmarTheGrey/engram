---
date: 2026-11-19
author: claude-agent
type: change
card: L3
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - research/scripts/l3_variance.py
  - research/tests/test_l3_variance.py
  - research/configs/l3-variance.json
  - research/configs/l3-variance-fixture.json
  - "make l3-variance FIXTURE=1"
supersedes: none
---

**What.** research/scripts/l3_variance.py reports the model-based lints' spread across seeds from a lint run replayed offline, and is proven on the scripted cassette replay.

**Why.** Card L3's acceptance is variance across three seeds on the pilot set; the script must exist and be tested before the live run, which needs the key.

**Result.** On the scripted run (`make l3-variance FIXTURE=1`) it recovers the planted spread: contradiction precision 1, 1, 0.667 and recall 1, 0.5, 1 over seeds 1 to 3, 9 of 12 units answered alike; unsupported-claim recall 1, 1, 0.667. These are a script's numbers, not results (research/tests/test_l3_variance.py, 5 tests).

**Consequence.** research/configs/l3-variance.json refuses until its `model` names the model that filled prereg/M1; then `make l3-variance` writes research/results/l3-variance.json and a MANIFEST row is added.

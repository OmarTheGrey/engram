---
date: 2026-11-28
author: claude-agent
type: measurement
card: L9
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h3-l9-grounding.json
  - research/configs/l9-grounding.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/l9_grounding.py --config research/configs/l9-grounding.json --out research/results/h3-l9-grounding.json"
supersedes: docs/log/2026-11-28-l9-measurement-grounding.md
---

**What.** The unregistered row `research/results/h3-l9-grounding.json` moved once, after the review of 2026-11-28: its body gains a `note` that the planted quotes produce every change between the two runs.

**Why.** Review finding L9-3: a reader of the JSON alone saw a precision gain without the caveat, which lived only in the register, the page and the docstring.

**Result.** Still a proof of concept on fixtures with a scripted model, not a hypothesis result. Every count is as before: 14 findings plain, 1 against a pass label; 11 grounded, 0 against one; 3 ungrounded, 2 labelled flag; 0 new calls in either replay. The shared-span rule of finding L9-1 changes no row of the fixture run (results.jsonl sha256 250872a5... before and after). New sha256 `c895152f...9ced`, MANIFEST commit 260a0f06.

**Consequence.** The register and the results page are regenerated from it.

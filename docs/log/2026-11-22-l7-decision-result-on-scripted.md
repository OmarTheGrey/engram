---
date: 2026-11-22
author: claude-agent
type: decision
card: L7
chapter: evaluation
pillar: research
hypothesis: H3
evidence:
  - research/scripts/h3_lint_nli.py
  - research/results/h3-lint-nli.json
supersedes: none
---

**What.** Wrote the fixture report under research/results with `registered: false`, although its model tier is card L4's scripted model.

**Why.** The task asks for an h3- result with a MANIFEST row; h3_lint_delta.py refuses scripted runs under research/results, so a new script beside it was written.

**Result.** The result separates what the real NLI scores give (bands, calls saved, each label's band, the tier alone) from what the scripted model gives (model tier and tiered figures, labelled pipeline checks in `limits`).

**Consequence.** If the lead prefers, the result moves to .engram and its row is dropped. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.

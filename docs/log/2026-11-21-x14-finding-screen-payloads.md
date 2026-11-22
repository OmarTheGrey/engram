---
date: 2026-11-21
author: claude-agent
type: finding
card: X14
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-redteam.json
supersedes: none
---

**What.** On the public payload sets the injection screen at default stops 316 of Lakera's 1,000 rows and 4 of deepset's 263 injections (write route, tool source).

**Why.** These sets were not seen by the screen's card, unlike AMSB, whose detectors it copies.

**Result.** AMSB's prompt-injection family is stopped 4 of 4; the deepset injections, many in German and many mild, pass the English patterns almost whole.

**Consequence.** The screen is a floor for English instruction phrases, as its own result says; a reader should take the deepset rate, not the AMSB one, as its out-of-sample escape.

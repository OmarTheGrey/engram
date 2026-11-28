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
supersedes: none
---

**What.** `research/results/h3-l9-grounding.json`, a proof of concept on card L3's model fault fixtures with scripted models: card L3's run and card L9's grounded run, replayed offline.

**Why.** The addendum's proof-of-concept rule; the card's question of what grounding does to the model tier's findings.

**Result.** Not a hypothesis result. Both replays made 0 new calls (51 cached each); 51 verdicts identical. Plain: 14 findings, 1 against a pass label. Grounded: 11 findings, 0 against a pass label, each with its quotes; 3 flags ungrounded, 2 of them labelled flag (the planted paraphrase and short quote). Pooled over seeds, contradiction precision 0.833 to 1.0 at recall 0.833; unsupported-claim precision 1.0 both, recall 0.889 to 0.667. sha256 `da311b42...00f5`, MANIFEST commit 2174a87b.

**Consequence.** The register gains its section; the lead's question 2 is not decided by it (finding).

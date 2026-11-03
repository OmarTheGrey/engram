---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - research/configs/h1-cost.json
  - research/scripts/h1_cost.py
supersedes: none
---

**What.** The cost range: low is the fixture's own shape (one read, then the answer) at pi's four characters per token, one judge call, no reasoning, recorded note size; high adds two read turns, three characters per token, three judge calls, 1,024 reasoning tokens per answer call for catalogue-reasoning models, and the note's 300-token limit.

**Why.** Scripted cassettes fix the turns; plan decision 7 asks a range with its assumption stated. A live model may read more than once, tokenize JSON and ids densely, and reason although the runner asks for thinking off.

**Result.** Each extra read repeats the session so far plus a full-size read, so input grows quadratically in reads; memory per read comes from the full set's measured lists. Answers keep their scripted length; no caching or discount.

**Consequence.** If a live pilot shows more turns or reasoning, the config's numbers change and the script reprices.

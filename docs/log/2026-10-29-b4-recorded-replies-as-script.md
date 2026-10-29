---
date: 2026-10-29
author: claude-agent
type: decision
card: B4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - fixtures/bench/mem-inv-bench/script.json
  - fixtures/bench/mem-inv-bench/probe-script.json
  - packages/bench/scripts/vendor-mem-inv-bench.py
supersedes: none
---

**What.** The scripted model answers each case with the reference model's recorded trial-0 proposal (`openai/gpt-5.6-terra`, from the study's transcripts), and the self-summary note is that model's recorded paraphrase.

**Why.** The card asked for a scripted model and golden outcomes; recorded replies are real shapes the bucketer and the readings handle (one adjudicated hit, one hardened setting, one malformed purchase), where invented replies would test only what their author thought of. The summary is a model output upstream and no model may be called.

**Result.** 24 replies, each with its transcript line in `script.json`; records whose memory lacks the current attacker value are skipped, as upstream's `review._stale` does. Upstream's scorer gives 17 HIT, 2 REFUSED and 1 MALFORMED on the attacks.

**Consequence.** The fixture's verdicts are one model's recorded behaviour, not findings about Engram.
